"""Random floor-plan drawings with exact wall masks, for training the wall model.

Each sample is a greyscale drawing (uint8, white paper) and a mask (uint8, 1 = wall).
Plans are rooms from a random binary space partition, sometimes with a corner cut out.
Doors and windows are gaps in the mask. The drawing adds door arcs, window lines,
labels, dimensions, furniture, hatching and scan noise, none of which count as wall.
"""

import math
import random

import cv2
import numpy as np

WORDS = ["BEDROOM", "BED ROOM", "M.BED", "KITCHEN", "LIVING", "DINING", "HALL", "TOILET", "BATH", "POOJA",
         "STORE", "UTILITY", "BALCONY", "SIT OUT", "PORTICO", "STUDY", "DRESS", "W.C.", "LOBBY", "PASSAGE"]
FONTS = [cv2.FONT_HERSHEY_SIMPLEX, cv2.FONT_HERSHEY_PLAIN, cv2.FONT_HERSHEY_DUPLEX, cv2.FONT_HERSHEY_COMPLEX_SMALL]


def bsp(rect, rng, min_side, max_area):
    """Split a rectangle (x0, y0, x1, y1) into rooms; return (rooms, split lines)."""
    x0, y0, x1, y1 = rect
    w, h = x1 - x0, y1 - y0
    can_v, can_h = w >= 2 * min_side, h >= 2 * min_side
    if (w * h <= max_area and rng.random() < 0.7) or not (can_v or can_h):
        return [rect], []
    vertical = can_v and (not can_h or (w > h if rng.random() < 0.8 else rng.random() < 0.5))
    if vertical:
        s = rng.uniform(x0 + min_side, x1 - min_side)
        a, b = (x0, y0, s, y1), (s, y0, x1, y1)
        line = (s, y0, s, y1)
    else:
        s = rng.uniform(y0 + min_side, y1 - min_side)
        a, b = (x0, y0, x1, s), (x0, s, x1, y1)
        line = (x0, s, x1, s)
    ra, la = bsp(a, rng, min_side, max_area)
    rb, lb = bsp(b, rng, min_side, max_area)
    return ra + rb, [line] + la + lb


def sample(rng=None, res=None, meta=False):
    rng = rng or random.Random()
    res = res or rng.uniform(0.016, 0.036)  # metres per pixel
    Wm, Hm = rng.uniform(5, 16), rng.uniform(4, 13)
    margin = rng.uniform(0.8, 2.5)
    px = lambda v: int(round((v + margin) / res))
    W, H = px(Wm + margin), px(Hm + margin)

    rooms, splits = bsp((0, 0, Wm, Hm), rng, rng.uniform(1.8, 2.6), rng.uniform(8, 20))
    # Sometimes cut out a corner room so the outline is not a plain rectangle.
    outside = []
    if len(rooms) > 3 and rng.random() < 0.35:
        corners = [r for r in rooms if (r[0] == 0 or r[2] == Wm) and (r[1] == 0 or r[3] == Hm)]
        if corners:
            outside.append(corners[0])
            rooms = [r for r in rooms if r is not corners[0]]

    t_out = rng.choice([0.2, 0.23, 0.23, 0.3])
    t_in = rng.choice([0.1, 0.115, 0.115, 0.15, 0.23])
    tp = lambda t: max(2, int(round(t / res)))

    union = np.zeros((H, W), np.uint8)
    for r in rooms:
        cv2.rectangle(union, (px(r[0]), px(r[1])), (px(r[2]), px(r[3])), 1, -1)
    wall = np.zeros((H, W), np.uint8)
    for r in rooms:  # every room edge with the inner thickness
        a = tp(t_in) // 2
        for (xa, ya, xb, yb) in [(r[0], r[1], r[2], r[1]), (r[2], r[1], r[2], r[3]), (r[0], r[3], r[2], r[3]), (r[0], r[1], r[0], r[3])]:
            cv2.rectangle(wall, (px(min(xa, xb)) - a, px(min(ya, yb)) - a), (px(max(xa, xb)) + a, px(max(ya, yb)) + a), 1, -1)
    k = tp(t_out) // 2
    ker = cv2.getStructuringElement(cv2.MORPH_RECT, (2 * k + 1, 2 * k + 1))
    wall |= cv2.dilate(union, ker) & (1 - cv2.erode(union, ker))  # outer band
    # Columns at some outer corners.
    if rng.random() < 0.3:
        c = tp(t_out * rng.uniform(1.2, 1.8)) // 2
        for (x, y) in [(0, 0), (Wm, 0), (0, Hm), (Wm, Hm)]:
            if union[min(H - 1, px(y)), min(W - 1, px(x))] or rng.random() < 0.5:
                cv2.rectangle(wall, (px(x) - c, px(y) - c), (px(x) + c, px(y) + c), 1, -1)

    doors, windows = [], []

    def gap_on(seg, width, thick):
        xa, ya, xb, yb = seg
        L = abs(xb - xa) + abs(yb - ya)
        keep = 0.35 + thick
        if L < width + 2 * keep:
            return None
        c = rng.uniform(keep + width / 2, L - keep - width / 2)
        if ya == yb:
            x0 = min(xa, xb) + c - width / 2
            return (x0, ya, x0 + width, ya, "h")
        y0 = min(ya, yb) + c - width / 2
        return (xa, y0, xa, y0 + width, "v")

    for s in splits:  # one door per internal wall, sometimes two
        for _ in range(1 if rng.random() < 0.8 else 2):
            g = gap_on(s, rng.uniform(0.7, 1.0), t_in)
            if g:
                doors.append((g, t_in))
    for r in rooms:  # windows and an entrance on outside edges
        for seg in [(r[0], r[1], r[2], r[1]), (r[2], r[1], r[2], r[3]), (r[0], r[3], r[2], r[3]), (r[0], r[1], r[0], r[3])]:
            mx, my = (seg[0] + seg[2]) / 2, (seg[1] + seg[3]) / 2
            nx, ny = (0, 1) if seg[1] == seg[3] else (1, 0)
            out = [(mx + nx * 0.3 * s, my + ny * 0.3 * s) for s in (-1, 1)]
            if all(0 <= px(y) < H and 0 <= px(x) < W and union[px(y), px(x)] for x, y in out):
                continue  # interior edge
            if rng.random() < 0.65:
                g = gap_on(seg, rng.uniform(0.9, 2.1), t_out)
                if g:
                    windows.append((g, t_out))
            elif rng.random() < 0.15:
                g = gap_on(seg, rng.uniform(0.9, 1.2), t_out)
                if g:
                    doors.append((g, t_out))

    def cut(g, thick):
        x0, y0, x1, y1, o = g
        a = tp(thick) // 2 + 2
        if o == "h":
            cv2.rectangle(wall, (px(x0), px(y0) - a), (px(x1), px(y0) + a), 0, -1)
        else:
            cv2.rectangle(wall, (px(x0) - a, px(y0)), (px(x0) + a, px(y1)), 0, -1)

    for g, t in doors + windows:
        cut(g, t)

    img = draw(wall, union, rooms, doors, windows, px, res, rng, tp, W, H, Wm, Hm)
    if meta:  # ground truth in image metres, for evaluation
        m = lambda v: v + margin
        info = {"res": res, "rooms": [[m(r[0]), m(r[1]), r[2] - r[0], r[3] - r[1]] for r in rooms],
                "doors": len(doors), "windows": len(windows)}
        return img, wall, info
    # Small rotation, applied to both.
    if rng.random() < 0.3:
        ang = rng.uniform(-1.5, 1.5)
        M = cv2.getRotationMatrix2D((W / 2, H / 2), ang, 1)
        img = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=255)
        wall = cv2.warpAffine(wall, M, (W, H), flags=cv2.INTER_NEAREST, borderValue=0)
    return img, wall


def draw(wall, union, rooms, doors, windows, px, res, rng, tp, W, H, Wm, Hm):
    paper = rng.randint(225, 255)
    img = np.full((H, W), paper, np.uint8)
    ink = rng.randint(0, 70)
    lw = lambda: max(1, int(round(rng.uniform(0.008, 0.025) / res)))

    # Floor hatching and tiles inside some rooms (thin, light).
    for r in rooms:
        if rng.random() < 0.2:
            step = max(4, int(rng.uniform(0.3, 0.6) / res))
            tone = rng.randint(150, 215)
            for x in range(px(r[0]), px(r[2]), step):
                cv2.line(img, (x, px(r[1])), (x, px(r[3])), tone, 1)
            for y in range(px(r[1]), px(r[3]), step):
                cv2.line(img, (px(r[0]), y), (px(r[2]), y), tone, 1)

    style = rng.choices(["solid", "hollow", "hatch", "grey"], [0.4, 0.3, 0.15, 0.15])[0]
    contours, _ = cv2.findContours(wall, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    if style == "solid":
        img[wall > 0] = ink
    elif style == "grey":
        img[wall > 0] = rng.randint(90, 170)
        cv2.drawContours(img, contours, -1, ink, lw())
    elif style == "hatch":
        hatch = np.full((H, W), paper, np.uint8)
        step = max(3, int(rng.uniform(0.04, 0.1) / res))
        for d in range(-H, W, step):
            cv2.line(hatch, (d, 0), (d + H, H), ink, 1)
        img[wall > 0] = hatch[wall > 0]
        cv2.drawContours(img, contours, -1, ink, lw())
    else:
        cv2.drawContours(img, contours, -1, ink, lw())

    t = lw()
    for (x0, y0, x1, y1, o), thick in windows:  # two or three thin lines across the opening
        a = tp(thick) // 2
        n = rng.choice([2, 3])
        for i in range(n):
            off = int(-a + (2 * a) * (i + 0.5) / n) if n > 1 else 0
            if o == "h":
                cv2.line(img, (px(x0), px(y0) + off), (px(x1), px(y0) + off), ink, 1)
            else:
                cv2.line(img, (px(x0) + off, px(y0)), (px(x0) + off, px(y1)), ink, 1)
        if o == "h":
            for x in (px(x0), px(x1)):
                cv2.line(img, (x, px(y0) - a), (x, px(y0) + a), ink, 1)
        else:
            for y in (px(y0), px(y1)):
                cv2.line(img, (px(x0) - a, y), (px(x0) + a, y), ink, 1)

    for (x0, y0, x1, y1, o), thick in doors:  # leaf and swing arc
        r = px(x1) - px(x0) if o == "h" else px(y1) - px(y0)
        side = rng.choice([-1, 1])
        if o == "h":
            hx, hy = (px(x0), px(y0)) if rng.random() < 0.5 else (px(x1), px(y0))
            cv2.line(img, (hx, hy), (hx, hy + side * r), ink, t)
            start = 90 if side > 0 else 270
            sweep = (0 if hx == px(x0) else 180)
            cv2.ellipse(img, (hx, hy), (r, r), 0, min(start, sweep if sweep or side > 0 else 360), max(start, sweep if sweep or side > 0 else 360), ink, 1)
        else:
            hx, hy = (px(x0), px(y0)) if rng.random() < 0.5 else (px(x0), px(y1))
            cv2.line(img, (hx, hy), (hx + side * r, hy), ink, t)
            cv2.ellipse(img, (hx, hy), (r, r), 0, rng.choice([0, 90, 180, 270]), 0, ink, 1)

    # Furniture outlines.
    for r in rooms:
        for _ in range(rng.randint(0, 3)):
            fw, fd = rng.uniform(0.4, 2.0), rng.uniform(0.4, 2.0)
            if fw > r[2] - r[0] - 0.4 or fd > r[3] - r[1] - 0.4:
                continue
            fx = rng.uniform(r[0] + 0.2, r[2] - 0.2 - fw)
            fy = rng.uniform(r[1] + 0.2, r[3] - 0.2 - fd)
            p0, p1 = (px(fx), px(fy)), (px(fx + fw), px(fy + fd))
            shape = rng.random()
            if shape < 0.6:
                cv2.rectangle(img, p0, p1, ink, 1)
                if rng.random() < 0.5:
                    cv2.rectangle(img, (p0[0] + 3, p0[1] + 3), (p0[0] + (p1[0] - p0[0]) // 3, p1[1] - 3), ink, 1)
            else:
                cv2.ellipse(img, ((p0[0] + p1[0]) // 2, (p0[1] + p1[1]) // 2), ((p1[0] - p0[0]) // 2, (p1[1] - p0[1]) // 2), 0, 0, 360, ink, 1)

    # Room labels and sizes.
    for r in rooms:
        if rng.random() < 0.85:
            font = rng.choice(FONTS)
            scale = rng.uniform(0.25, 0.6) * (0.025 / res)
            th = 1 if rng.random() < 0.7 else 2
            cx, cy = px((r[0] + r[2]) / 2), px((r[1] + r[3]) / 2)
            word = rng.choice(WORDS)
            size = f"{rng.randint(8, 18)}'{rng.randint(0, 11)}\"X{rng.randint(8, 16)}'{rng.randint(0, 11)}\""
            cv2.putText(img, word, (cx - 30, cy), font, scale, ink, th, cv2.LINE_AA)
            if rng.random() < 0.7:
                cv2.putText(img, size, (cx - 35, cy + int(14 * scale * 2)), font, scale * 0.8, ink, 1, cv2.LINE_AA)

    # Dimension lines outside the outline.
    if rng.random() < 0.6:
        off = rng.uniform(0.4, 0.8)
        y = px(-off)
        cv2.line(img, (px(0), y), (px(Wm), y), ink, 1)
        for x in (px(0), px(Wm)):
            cv2.line(img, (x - 4, y + 4), (x + 4, y - 4), ink, 1)
        cv2.putText(img, f"{int(Wm / 0.3048)}'-{rng.randint(0, 11)}\"", (px(Wm / 2) - 20, y - 4), rng.choice(FONTS), 0.5 * (0.025 / res), ink, 1, cv2.LINE_AA)
        x = px(-off)
        cv2.line(img, (x, px(0)), (x, px(Hm)), ink, 1)

    # Faint grid on some sheets.
    if rng.random() < 0.15:
        step = max(6, int(rng.uniform(0.5, 1.0) / res))
        tone = rng.randint(200, 235)
        for x in range(0, W, step):
            cv2.line(img, (x, 0), (x, H), tone, 1)
        for y in range(0, H, step):
            cv2.line(img, (0, y), (W, y), tone, 1)

    # Scan and print artefacts.
    if rng.random() < 0.5:
        img = cv2.GaussianBlur(img, (0, 0), rng.uniform(0.3, 1.0))
    if rng.random() < 0.5:
        noise = np.random.default_rng(rng.randint(0, 2**31)).normal(0, rng.uniform(2, 10), img.shape)
        img = np.clip(img.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    if rng.random() < 0.3:  # uneven lighting from a phone photo
        gx = np.linspace(rng.uniform(-30, 0), rng.uniform(0, 30), W, dtype=np.float32)
        img = np.clip(img.astype(np.float32) + gx[None, :], 0, 255).astype(np.uint8)
    if rng.random() < 0.6:
        ok, enc = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, rng.randint(35, 95)])
        img = cv2.imdecode(enc, cv2.IMREAD_GRAYSCALE)
    return img


if __name__ == "__main__":
    import os
    import sys

    out = sys.argv[1] if len(sys.argv) > 1 else "runs/samples"
    os.makedirs(out, exist_ok=True)
    for i in range(8):
        img, mask = sample(random.Random(i))
        cv2.imwrite(f"{out}/{i}_img.png", img)
        cv2.imwrite(f"{out}/{i}_mask.png", mask * 255)
    print("wrote", out)
