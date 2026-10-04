"""Train the wall-segmentation model on generated plans and export it to ONNX.

    .venv/bin/python train.py --steps 6000 --out ../../public/models/wallnet-v1.onnx

Input:  float32 [1, 1, H, W], greyscale scaled to 0–1 (white paper = 1), H and W multiples of 16,
        drawn at about 0.016–0.036 m per pixel (the app uses 0.025).
Output: float32 [1, 1, H, W] logits; > 0 means wall.
"""

import argparse
import math
import random
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, IterableDataset

from synth import sample

CROP = 320


class Block(nn.Sequential):
    def __init__(self, cin, cout):
        super().__init__(
            nn.Conv2d(cin, cout, 3, padding=1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True),
            nn.Conv2d(cout, cout, 3, padding=1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True),
        )


class WallNet(nn.Module):
    """A small U-Net with four 2× downsamplings."""

    def __init__(self, c=16):
        super().__init__()
        ch = [c, c * 2, c * 4, c * 8, c * 8]
        self.enc = nn.ModuleList([Block(1, ch[0])] + [Block(ch[i], ch[i + 1]) for i in range(4)])
        self.dec = nn.ModuleList([Block(ch[i + 1] + ch[i], ch[i]) for i in reversed(range(4))])
        self.head = nn.Conv2d(ch[0], 1, 1)

    def forward(self, x):
        skips = []
        for i, b in enumerate(self.enc):
            x = b(x if i == 0 else F.max_pool2d(x, 2))
            skips.append(x)
        skips.pop()
        for b in self.dec:
            s = skips.pop()
            x = b(torch.cat([F.interpolate(x, size=s.shape[-2:], mode="bilinear", align_corners=False), s], 1))
        return self.head(x)


class Plans(IterableDataset):
    def __iter__(self):
        info = torch.utils.data.get_worker_info()
        rng = random.Random((info.id if info else 0) * 7919 + int(time.time() * 1000) % 100000)
        while True:
            img, mask = sample(rng)
            h, w = img.shape
            if h < CROP or w < CROP:  # pad with paper
                ph, pw = max(0, CROP - h), max(0, CROP - w)
                img = np.pad(img, ((0, ph), (0, pw)), constant_values=255)
                mask = np.pad(mask, ((0, ph), (0, pw)))
                h, w = img.shape
            # Two crops per drawing, biased towards areas with walls.
            for _ in range(2):
                y, x = rng.randint(0, h - CROP), rng.randint(0, w - CROP)
                yield (torch.from_numpy(img[y:y + CROP, x:x + CROP].astype(np.float32) / 255.0)[None],
                       torch.from_numpy(mask[y:y + CROP, x:x + CROP].astype(np.float32))[None])


def loss_fn(logits, target):
    bce = F.binary_cross_entropy_with_logits(logits, target, pos_weight=torch.tensor(2.0, device=logits.device))
    p = torch.sigmoid(logits)
    inter = (p * target).sum((1, 2, 3))
    dice = 1 - (2 * inter + 1) / (p.sum((1, 2, 3)) + target.sum((1, 2, 3)) + 1)
    return bce + dice.mean()


def pad16(x, value):
    h, w = x.shape[-2:]
    return F.pad(x, (0, (16 - w % 16) % 16, 0, (16 - h % 16) % 16), value=value)


@torch.no_grad()
def evaluate(model, device, n=40, seed=12345):
    model.eval()
    rng, inter, union = random.Random(seed), 0, 0
    for _ in range(n):
        img, mask = sample(rng)
        h, w = img.shape
        x = pad16(torch.from_numpy(img.astype(np.float32) / 255.0)[None, None], 1.0).to(device)
        pred = (model(x)[0, 0, :h, :w] > 0).cpu().numpy()
        m = mask > 0
        inter += (pred & m).sum()
        union += (pred | m).sum()
    model.train()
    return inter / max(1, union)


def export(model, path):
    model = model.cpu().eval()
    x = torch.ones(1, 1, 320, 480)
    torch.onnx.export(model, (x,), path, input_names=["image"], output_names=["logits"], opset_version=17,
                      dynamic_axes={"image": {2: "h", 3: "w"}, "logits": {2: "h", 3: "w"}}, dynamo=False)
    import onnxruntime as ort
    sess = ort.InferenceSession(path)
    y = sess.run(None, {"image": x.numpy()})[0]
    ref = model(x).detach().numpy()
    print(f"exported {path}; max |onnx - torch| = {np.abs(y - ref).max():.2e}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=6000)
    ap.add_argument("--batch", type=int, default=12)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--width", type=int, default=16)
    ap.add_argument("--ckpt", default="runs/wallnet.pt")
    ap.add_argument("--out", default="runs/wallnet.onnx")
    args = ap.parse_args()

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    torch.manual_seed(0)
    model = WallNet(args.width).to(device)
    print(f"device {device}; {sum(p.numel() for p in model.parameters()) / 1e6:.2f}M parameters")
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1, s / 200) * 0.5 * (1 + math.cos(math.pi * min(1, s / args.steps))))
    loader = DataLoader(Plans(), batch_size=args.batch, num_workers=args.workers, persistent_workers=args.workers > 0)

    t0, run = time.time(), 0.0
    for step, (x, y) in enumerate(loader, 1):
        x, y = x.to(device), y.to(device)
        loss = loss_fn(model(x), y)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
        sched.step()
        run = 0.98 * run + 0.02 * loss.item() if step > 1 else loss.item()
        if step % 100 == 0:
            print(f"step {step}/{args.steps}  loss {run:.4f}  lr {sched.get_last_lr()[0]:.2e}  {time.time() - t0:.0f}s", flush=True)
        if step % 1000 == 0 or step == args.steps:
            torch.save(model.state_dict(), args.ckpt)
            print(f"  val IoU {evaluate(model, device):.3f}", flush=True)
        if step >= args.steps:
            break
    export(model, args.out)


if __name__ == "__main__":
    main()
