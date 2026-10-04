import { M, box, cyl, mat, tint } from '../parts.js';

function bedBase(g, it, m, y0 = 0) {
  const { w: W, d: D } = it;
  box(g, W, 0.32, D, m, 0, y0 + 0.16, 0);
  box(g, W - 0.06, 0.2, D - 0.1, M.linen, 0, y0 + 0.42, 0.03);
  const n = it.params.pillows || 1, pw = (W - 0.2) / n;
  for (let i = 0; i < n; i++) box(g, pw - 0.06, 0.12, 0.4, M.white, -W / 2 + 0.1 + pw * (i + 0.5), y0 + 0.58, -D / 2 + 0.35);
  box(g, W - 0.02, 0.035, D * 0.55, mat(tint(it._color, '#ffffff', 0.55)), 0, y0 + 0.535, D * 0.2);
}

export function bed(g, it, m) {
  bedBase(g, it, m);
  box(g, it.w, it.h, 0.08, m, 0, it.h / 2, -it.d / 2 + 0.04);
}

export function bunk(g, it, m) {
  const { w: W, d: D, h: H } = it;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.06, H, 0.06, m, sx * (W / 2 - 0.03), H / 2, sz * (D / 2 - 0.03));
  const lower = { ...it, d: D - 0.08, params: { pillows: 1 } };
  bedBase(g, lower, m, 0.05);
  bedBase(g, lower, m, 0.95);
  box(g, 0.04, 0.2, D * 0.6, m, -W / 2 + 0.02, 1.55, -D * 0.15);
  // ladder at the foot end
  for (const sx of [W / 2 - 0.05, W / 2 - 0.38]) box(g, 0.04, H, 0.04, M.steel, sx, H / 2, D / 2 + 0.03);
  for (let i = 1; i <= 5; i++) box(g, 0.33, 0.025, 0.025, M.steel, W / 2 - 0.215, i * 0.28, D / 2 + 0.03);
}

export function nightstand(g, it, m) {
  const { w: W, d: D, h: H } = it;
  box(g, W, H, D, m, 0, H / 2, 0);
  box(g, W - 0.02, 0.006, 0.006, M.dark, 0, H * 0.55, D / 2 + 0.003);
  box(g, 0.1, 0.015, 0.02, M.steel, 0, H * 0.75, D / 2 + 0.01);
  cyl(g, 0.06, 0.08, 0.04, M.dark, W * 0.2, H + 0.02, 0, 16);
  cyl(g, 0.01, 0.01, 0.25, M.dark, W * 0.2, H + 0.15, 0, 6);
  cyl(g, 0.07, 0.1, 0.14, M.lampShade, W * 0.2, H + 0.3, 0, 18);
}

export function wardrobe(g, it, m) {
  const { w: W, d: D, h: H } = it, p = it.params, doors = p.doors || 2;
  box(g, W, H - 0.08, D, m, 0, 0.08 + (H - 0.08) / 2, 0);
  box(g, W - 0.04, 0.08, D - 0.05, M.dark, 0, 0.04, -0.02);
  if (p.sliding) {
    box(g, W / 2 + 0.02, H - 0.12, 0.02, mat(tint(it._color, '#000000', 0.1)), -W / 4, 0.06 + (H - 0.08) / 2, D / 2 + 0.01);
    box(g, W / 2 + 0.02, H - 0.12, 0.02, m, W / 4, 0.06 + (H - 0.08) / 2, D / 2 + 0.035);
    box(g, W / 2 - 0.2, H - 0.5, 0.005, M.mirror, W / 4, 0.06 + (H - 0.08) / 2, D / 2 + 0.048);
    return;
  }
  for (let i = 1; i < doors; i++) box(g, 0.006, H - 0.14, 0.006, M.dark, -W / 2 + (i * W) / doors, 0.08 + (H - 0.08) / 2, D / 2 + 0.003);
  for (let i = 0; i < doors; i++) {
    const edge = -W / 2 + ((i + (i % 2 ? 0 : 1)) * W) / doors, x = edge + (i % 2 ? 0.04 : -0.04);
    box(g, 0.02, 0.32, 0.025, M.steel, x, 1.1, D / 2 + 0.015);
  }
  box(g, W, 0.01, D + 0.01, M.dark, 0, H - 0.5, 0.002);
}

export function dresser(g, it, m) {
  const { w: W, d: D } = it;
  box(g, W, 0.75, D, m, 0, 0.375, 0);
  for (const y of [0.25, 0.5]) box(g, W - 0.02, 0.006, 0.006, M.dark, 0, y, D / 2 + 0.003);
  box(g, W * 0.62, 0.84, 0.03, m, 0, 1.2, -D / 2 + 0.03);
  box(g, W * 0.56, 0.76, 0.01, M.mirror, 0, 1.2, -D / 2 + 0.05);
  box(g, 0.45, 0.04, 0.32, m, 0, 0.45, D / 2 + 0.25);
  cyl(g, 0.03, 0.03, 0.43, M.steel, 0, 0.215, D / 2 + 0.25, 8);
}
