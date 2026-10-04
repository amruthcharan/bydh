"""Write held-out plans, model masks and ground truth for eval.mjs.

    .venv/bin/python eval_dump.py ../../public/models/wallnet-v1.onnx runs/eval 60
"""
import json
import os
import random
import sys

import cv2
import numpy as np
import onnxruntime as ort

from synth import sample

model, out, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
os.makedirs(out, exist_ok=True)
sess = ort.InferenceSession(model)
truth = []
for i in range(n):
    img, wall, info = sample(random.Random(10_000 + i), res=0.025, meta=True)  # seeds never used in training
    h, w = img.shape
    ph, pw = (16 - h % 16) % 16, (16 - w % 16) % 16
    x = np.pad(img.astype(np.float32) / 255, ((0, ph), (0, pw)), constant_values=1)[None, None]
    pred = (sess.run(None, {"image": x})[0][0, 0, :h, :w] > 0).astype(np.uint8)
    cv2.imwrite(f"{out}/{i}_img.png", img)
    cv2.imwrite(f"{out}/{i}_model.png", pred * 255)
    cv2.imwrite(f"{out}/{i}_truth.png", wall * 255)
    truth.append({"id": i, **info})
json.dump(truth, open(f"{out}/truth.json", "w"))
print("wrote", n, "plans to", out)
