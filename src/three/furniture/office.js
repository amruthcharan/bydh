import * as THREE from 'three';
import { M, box, cyl, mat, tint } from '../parts.js';

export function desk(g, it, m) {
  const { w: W, d: D, h: H } = it;
  box(g, W, 0.035, D, m, 0, H - 0.018, 0);
  box(g, 0.03, H - 0.035, D - 0.04, m, -W / 2 + 0.015, (H - 0.035) / 2, 0);
  box(g, 0.4, H - 0.035, D - 0.04, m, W / 2 - 0.2, (H - 0.035) / 2, 0);
  for (const y of [0.25, 0.48]) box(g, 0.38, 0.006, 0.006, M.dark, W / 2 - 0.2, y, D / 2 - 0.017);
  box(g, 0.55, 0.34, 0.025, M.dark, -0.1, H + 0.26, -D / 2 + 0.15);
  box(g, 0.06, 0.09, 0.06, M.dark, -0.1, H + 0.045, -D / 2 + 0.15);
  box(g, 0.42, 0.015, 0.14, M.dark, -0.1, H + 0.008, 0.05);
}

export function ldesk(g, it, m) {
  const { w: W, d: D, h: H } = it;
  box(g, W, 0.035, 0.6, m, 0, H - 0.018, -D / 2 + 0.3);
  box(g, 0.6, 0.035, D - 0.6, m, W / 2 - 0.3, H - 0.018, 0.3);
  box(g, 0.03, H - 0.035, 0.56, m, -W / 2 + 0.015, (H - 0.035) / 2, -D / 2 + 0.3);
  box(g, 0.56, H - 0.035, 0.03, m, W / 2 - 0.3, (H - 0.035) / 2, D / 2 - 0.015);
  box(g, 0.55, 0.34, 0.025, M.dark, -0.2, H + 0.26, -D / 2 + 0.12);
  box(g, 0.06, 0.09, 0.06, M.dark, -0.2, H + 0.045, -D / 2 + 0.12);
}

export function officeChair(g, it, m) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2, leg = box(g, 0.28, 0.03, 0.04, M.dark, Math.cos(a) * 0.14, 0.07, Math.sin(a) * 0.14);
    leg.rotation.y = -a;
    cyl(g, 0.025, 0.025, 0.04, M.dark, Math.cos(a) * 0.27, 0.03, Math.sin(a) * 0.27, 10);
  }
  cyl(g, 0.03, 0.03, 0.36, M.steel, 0, 0.26, 0, 10);
  box(g, 0.5, 0.08, 0.48, m, 0, 0.48, 0.02);
  const back = box(g, 0.46, 0.58, 0.06, m, 0, 0.83, -0.22); back.rotation.x = -0.12;
  for (const sx of [-0.24, 0.24]) { box(g, 0.04, 0.2, 0.04, M.dark, sx, 0.6, 0.02); box(g, 0.06, 0.03, 0.26, M.dark, sx, 0.71, 0.04); }
}

export function filing(g, it, m) {
  const { w: W, d: D, h: H } = it, body = mat(it._color, { roughness: 0.4, metalness: 0.4 });
  box(g, W, H, D, body, 0, H / 2, 0);
  for (let i = 1; i < 4; i++) box(g, W - 0.02, 0.006, 0.006, M.dark, 0, (i * H) / 4, D / 2 + 0.003);
  for (let i = 0; i < 4; i++) box(g, 0.12, 0.02, 0.025, M.steel, 0, ((i + 0.72) * H) / 4, D / 2 + 0.012);
}

export function pooja(g, it, m) {
  const { w: W, d: D, h: H } = it, wall = it.params.wall;
  const trim = M.gold, inner = mat(tint(it._color, '#7A2E2E', 0.55));
  if (wall) {
    box(g, W, H, D, m, 0, H / 2, 0);
    box(g, W - 0.1, H - 0.22, 0.02, inner, 0, H / 2 - 0.03, -D / 2 + 0.03);
    box(g, W, 0.04, D + 0.04, trim, 0, 0.02, 0.02);
    const top = new THREE.Mesh(new THREE.ConeGeometry(W * 0.32, 0.22, 4), trim); top.position.set(0, H + 0.11, 0); top.rotation.y = Math.PI / 4; top.castShadow = true; g.add(top);
    cyl(g, 0.03, 0.04, 0.03, trim, 0, 0.055, 0.05, 12);
    return;
  }
  box(g, W, 0.8, D, m, 0, 0.4, 0);
  box(g, 0.006, 0.74, 0.006, M.dark, 0, 0.4, D / 2 + 0.003);
  box(g, W, 0.05, D, trim, 0, 0.825, 0);
  for (const sx of [-1, 1]) box(g, 0.06, H - 1.1, 0.06, trim, sx * (W / 2 - 0.05), 0.85 + (H - 1.1) / 2, D / 2 - 0.05);
  box(g, W - 0.04, H - 0.85 - 0.25, 0.02, inner, 0, 0.85 + (H - 1.1) / 2, -D / 2 + 0.02);
  box(g, W, 0.08, D, m, 0, H - 0.21, 0);
  const top = new THREE.Mesh(new THREE.ConeGeometry(W * 0.42, 0.25, 4), trim); top.position.set(0, H - 0.04, 0); top.rotation.y = Math.PI / 4; top.castShadow = true; g.add(top);
  for (const sx of [-0.15, 0.15]) cyl(g, 0.03, 0.04, 0.03, trim, sx, 0.865, D / 2 - 0.1, 12);
}

export function plant(g, it, m) {
  const s = it.params.size || 1;
  cyl(g, 0.16 * s + 0.04, 0.12 * s + 0.03, 0.38 * s, m, 0, 0.19 * s, 0, 20);
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 * s + 0.05, 1), M.leaf);
  leaf.position.y = 0.38 * s + 0.35 * s; leaf.scale.set(1, 1.35, 1); leaf.castShadow = true; g.add(leaf);
  if (s > 0.8) { const l2 = leaf.clone(); l2.position.set(0.08, 1.05 * s, -0.04); l2.scale.set(0.7, 0.9, 0.7); g.add(l2); }
}

export function shoeRack(g, it, m) {
  const { w: W, d: D, h: H } = it;
  box(g, W, H - 0.05, D, m, 0, 0.05 + (H - 0.05) / 2, 0);
  box(g, W - 0.04, 0.05, D - 0.04, M.dark, 0, 0.025, 0);
  box(g, 0.006, H - 0.1, 0.006, M.dark, 0, 0.05 + (H - 0.05) / 2, D / 2 + 0.003);
  box(g, W + 0.02, 0.025, D + 0.02, mat(tint(it._color, '#000000', 0.2)), 0, H, 0);
  for (const sx of [-0.04, 0.04]) box(g, 0.015, 0.12, 0.02, M.steel, sx, H - 0.15, D / 2 + 0.01);
}
