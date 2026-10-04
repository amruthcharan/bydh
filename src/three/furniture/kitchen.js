import { M, box, cyl, mat, tint } from '../parts.js';

export function base(g, it, m) {
  const { w: W, d: D } = it, p = it.params;
  box(g, W - 0.004, 0.76, D - 0.03, m, 0, 0.1 + 0.38, -0.015);
  box(g, W - 0.04, 0.1, D - 0.08, M.dark, 0, 0.05, -0.04);
  box(g, W + 0.002, 0.04, D + 0.02, M.granite, 0, 0.88, 0.005);
  box(g, W - 0.04, 0.018, 0.02, M.steel, 0, 0.82, D / 2 - 0.005);
  if (W >= 0.8) box(g, 0.005, 0.66, 0.005, M.dark, 0, 0.47, D / 2 - 0.012);
  if (p.sink) {
    box(g, 0.56, 0.012, 0.42, M.steel, 0, 0.903, 0.02);
    box(g, 0.48, 0.006, 0.34, M.dark, 0, 0.905, 0.02);
    cyl(g, 0.018, 0.022, 0.3, M.steel, 0, 1.05, -D / 2 + 0.08, 10);
    box(g, 0.03, 0.03, 0.18, M.steel, 0, 1.19, -D / 2 + 0.16);
  }
  if (p.hob) {
    box(g, 0.78, 0.012, 0.5, M.dark, 0, 0.905, 0.02);
    for (const sx of [-0.22, 0.22]) for (const sz of [-0.11, 0.13]) cyl(g, 0.07, 0.08, 0.025, M.granite, sx, 0.92, sz, 20);
  }
}

export function wallCab(g, it, m) {
  const { w: W, d: D, h: H } = it;
  box(g, W, H, D, m, 0, H / 2, 0);
  if (W >= 0.8) box(g, 0.005, H - 0.04, 0.005, M.dark, 0, H / 2, D / 2 + 0.003);
  box(g, W - 0.06, 0.016, 0.02, M.steel, 0, 0.03, D / 2 + 0.01);
}

export function tall(g, it, m) {
  const { w: W, d: D, h: H } = it;
  box(g, W, H - 0.1, D - 0.02, m, 0, 0.1 + (H - 0.1) / 2, -0.01);
  box(g, W - 0.04, 0.1, D - 0.08, M.dark, 0, 0.05, -0.04);
  box(g, W - 0.01, 0.006, 0.006, M.dark, 0, 1.3, D / 2 + 0.001);
  box(g, 0.02, 0.4, 0.025, M.steel, W / 2 - 0.05, 1.05, D / 2 + 0.01);
  box(g, 0.02, 0.3, 0.025, M.steel, W / 2 - 0.05, 1.5, D / 2 + 0.01);
}

export function fridge(g, it, m) {
  const { w: W, d: D, h: H } = it, doors = it.params.doors || 1;
  const body = mat(it._color, { roughness: 0.35, metalness: 0.35 });
  box(g, W, H, D, body, 0, H / 2, 0);
  if (doors === 2) {
    box(g, W - 0.01, 0.006, 0.006, M.dark, 0, H * 0.32, D / 2 + 0.003);
    box(g, 0.025, 0.35, 0.04, M.steel, W / 2 - 0.06, H * 0.5, D / 2 + 0.02);
    box(g, 0.025, 0.25, 0.04, M.steel, W / 2 - 0.06, H * 0.22, D / 2 + 0.02);
  } else {
    box(g, W - 0.01, 0.006, 0.006, M.dark, 0, H * 0.75, D / 2 + 0.003);
    box(g, 0.025, 0.3, 0.04, M.steel, W / 2 - 0.06, H * 0.55, D / 2 + 0.02);
  }
}

export function chimney(g, it, m) {
  const { w: W, d: D, h: H } = it;
  const body = mat(it._color, { roughness: 0.3, metalness: 0.6 });
  box(g, W, 0.12, D, body, 0, 0.06, 0);
  box(g, W * 0.92, 0.01, D * 0.85, M.dark, 0, 0.0, 0.01);
  box(g, W * 0.32, H - 0.12, D * 0.42, body, 0, 0.12 + (H - 0.12) / 2, -D / 2 + D * 0.21);
}

export function breakfast(g, it, m) {
  const { w: W, d: D, h: H } = it;
  box(g, W, 0.04, D, M.granite, 0, H - 0.02, 0);
  box(g, W - 0.1, H - 0.04, 0.12, m, 0, (H - 0.04) / 2, -D / 2 + 0.1);
  const seat = mat(tint(it._color, '#000000', 0.25));
  for (const sx of [-W / 4, W / 4]) {
    cyl(g, 0.17, 0.17, 0.05, seat, sx, 0.72, D / 2 + 0.25, 20);
    cyl(g, 0.022, 0.022, 0.7, M.steel, sx, 0.35, D / 2 + 0.25, 8);
    cyl(g, 0.18, 0.2, 0.02, M.steel, sx, 0.01, D / 2 + 0.25, 20);
    const ring = cyl(g, 0.14, 0.14, 0.015, M.steel, sx, 0.3, D / 2 + 0.25, 20); ring.castShadow = false;
  }
}
