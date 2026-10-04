import { M, box, cyl, mat, tint } from '../parts.js';

// Front of every model faces +z; origin is the centre of the footprint at floor level.

export function sofa(g, it, m) {
  const { w: W, d: D } = it, seats = it.params.seats || 3, a = seats === 1 ? 0.16 : 0.18;
  box(g, W, 0.42, D, m, 0, 0.21, 0);
  box(g, W, 0.45, 0.2, m, 0, 0.62, -D / 2 + 0.1);
  box(g, a, 0.25, D, m, -W / 2 + a / 2, 0.55, 0);
  box(g, a, 0.25, D, m, W / 2 - a / 2, 0.55, 0);
  const cw = (W - 2 * a) / seats, cm = mat(tint(it._color, '#ffffff', 0.12));
  for (let i = 0; i < seats; i++) {
    const x = -W / 2 + a + cw * (i + 0.5);
    box(g, cw - 0.03, 0.1, D - 0.25, cm, x, 0.47, 0.08);
    box(g, cw - 0.05, 0.36, 0.12, cm, x, 0.66, -D / 2 + 0.25);
  }
}

export function lsofa(g, it, m) {
  const { w: W, d: D } = it, cm = mat(tint(it._color, '#ffffff', 0.12));
  box(g, W, 0.42, 0.9, m, 0, 0.21, -D / 2 + 0.45);
  box(g, W, 0.45, 0.2, m, 0, 0.62, -D / 2 + 0.1);
  const cl = D - 0.9;
  box(g, 0.9, 0.42, cl, m, W / 2 - 0.45, 0.21, -D / 2 + 0.9 + cl / 2);
  box(g, 0.2, 0.45, D, m, W / 2 - 0.1, 0.62, 0);
  box(g, 0.18, 0.25, 0.9, m, -W / 2 + 0.09, 0.55, -D / 2 + 0.45);
  for (let i = 0; i < 3; i++) box(g, (W - 1.1) / 3 - 0.03, 0.1, 0.65, cm, -W / 2 + 0.18 + ((W - 1.1) / 3) * (i + 0.5), 0.47, -D / 2 + 0.55);
  box(g, 0.66, 0.1, D - 0.25, cm, W / 2 - 0.53, 0.47, 0.1);
}

export function recliner(g, it, m) {
  const { w: W, d: D } = it;
  box(g, W, 0.45, D * 0.7, m, 0, 0.225, -D * 0.15);
  const back = box(g, W - 0.1, 0.65, 0.18, m, 0, 0.78, -D / 2 + 0.16); back.rotation.x = -0.25;
  box(g, 0.14, 0.25, D * 0.7, m, -W / 2 + 0.07, 0.57, -D * 0.15);
  box(g, 0.14, 0.25, D * 0.7, m, W / 2 - 0.07, 0.57, -D * 0.15);
  box(g, W - 0.28, 0.12, 0.35, m, 0, 0.32, D / 2 - 0.18);
}

export function table(g, it, m) {
  const { w: W, d: D, h: H } = it, p = it.params;
  if (p.round) {
    cyl(g, W / 2, W / 2, 0.035, m, 0, H - 0.018, 0, 36);
    cyl(g, 0.03, 0.03, H - 0.04, m, 0, (H - 0.04) / 2, 0, 12);
    cyl(g, W * 0.3, W * 0.32, 0.03, m, 0, 0.015, 0, 28);
    return;
  }
  box(g, W, 0.04, D, m, 0, H - 0.02, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.045, H - 0.04, 0.045, m, sx * (W / 2 - 0.05), (H - 0.04) / 2, sz * (D / 2 - 0.05));
  if (p.shelf) box(g, W - 0.08, 0.025, D - 0.08, m, 0, 0.1, 0);
}

export function tvUnit(g, it, m) {
  const { w: W, d: D, h: H } = it, p = it.params;
  box(g, W, 0.45, D, m, 0, 0.225, 0);
  box(g, W - 0.02, 0.006, 0.006, M.dark, 0, 0.225, D / 2 + 0.003);
  const tw = Math.min(1.45, W * 0.68), th = tw * 0.565;
  if (p.panel) {
    box(g, W, H - 0.45, 0.04, mat(tint(it._color, '#000000', 0.18)), 0, 0.45 + (H - 0.45) / 2, -D / 2 + 0.02);
    box(g, W * 0.22, 0.03, 0.25, m, -W / 2 + W * 0.13, 1.55, -D / 2 + 0.16);
    box(g, W * 0.22, 0.03, 0.25, m, W / 2 - W * 0.13, 1.55, -D / 2 + 0.16);
    box(g, tw, th, 0.04, M.dark, 0, 1.25, -D / 2 + 0.07);
  } else {
    box(g, tw, th, 0.05, M.dark, 0, 0.45 + 0.08 + th / 2, -0.04);
    box(g, 0.28, 0.06, 0.18, M.dark, 0, 0.48, -0.04);
  }
}

export function shelf(g, it, m) {
  const { w: W, d: D, h: H } = it;
  box(g, 0.03, H, D, m, -W / 2 + 0.015, H / 2, 0); box(g, 0.03, H, D, m, W / 2 - 0.015, H / 2, 0);
  box(g, W, H, 0.01, m, 0, H / 2, -D / 2 + 0.005);
  const levels = 5;
  for (let i = 0; i <= levels; i++) box(g, W - 0.06, 0.025, D - 0.01, m, 0, 0.02 + (i * (H - 0.04)) / levels, 0);
  const cols = ['#7A2E2E', '#2F4F5A', '#C8963F', '#5F7484', '#E8E3D8', '#4E7A4A'];
  for (let i = 0; i < levels; i++) {
    let x = -W / 2 + 0.05; const y0 = 0.035 + (i * (H - 0.04)) / levels;
    let k = 0;
    while (x < W / 2 - 0.12 && k < 14) {
      const bw = 0.025 + ((i * 7 + k * 3) % 5) * 0.008, bh = 0.18 + ((i + k) % 4) * 0.03;
      if ((i + k) % 6 !== 5) box(g, bw, bh, D * 0.7, mat(cols[(i * 3 + k) % cols.length]), x + bw / 2, y0 + bh / 2, 0.02);
      x += bw + 0.004; k++;
    }
  }
}

export function rug(g, it, m) {
  const r = box(g, it.w, 0.012, it.d, m, 0, 0.006, 0); r.castShadow = false;
  const b = box(g, it.w - 0.12, 0.013, it.d - 0.12, mat(tint(it._color, '#ffffff', 0.25)), 0, 0.007, 0); b.castShadow = false;
}

export function lamp(g, it, m) {
  const H = it.h;
  cyl(g, 0.15, 0.17, 0.03, m, 0, 0.015, 0, 24);
  cyl(g, 0.012, 0.012, H - 0.3, m, 0, (H - 0.3) / 2, 0, 8);
  cyl(g, 0.12, 0.18, 0.28, M.lampShade, 0, H - 0.14, 0, 24);
}

export function swing(g, it, m) {
  const { w: W, h: H } = it;
  box(g, 0.09, H, 0.09, m, -W / 2 + 0.045, H / 2, 0); box(g, 0.09, H, 0.09, m, W / 2 - 0.045, H / 2, 0);
  box(g, W, 0.09, 0.09, m, 0, H - 0.045, 0);
  box(g, 0.09, 0.05, 0.7, m, -W / 2 + 0.045, 0.025, 0); box(g, 0.09, 0.05, 0.7, m, W / 2 - 0.045, 0.025, 0);
  const sw = W - 0.36;
  box(g, sw, 0.06, 0.5, m, 0, 0.45, 0); box(g, sw, 0.4, 0.05, m, 0, 0.7, -0.22);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = cyl(g, 0.006, 0.006, H - 0.5, M.steel, sx * (sw / 2 - 0.02), 0.45 + (H - 0.5) / 2, sz * 0.2, 6);
    c.castShadow = false;
  }
  const cushion = mat(tint(it._color, '#C8963F', 0.6));
  box(g, sw - 0.04, 0.06, 0.44, cushion, 0, 0.51, 0.01);
}

