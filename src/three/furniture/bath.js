import * as THREE from 'three';
import { M, box, cyl, mat } from '../parts.js';

export function wc(g, it) {
  const { w: W, d: D } = it, wall = it.params.wall;
  if (wall) {
    box(g, W * 0.9, 0.3, D * 0.55, M.white, 0, 0.32, -D / 2 + D * 0.28);
    const s = cyl(g, W / 2, W * 0.4, 0.3, M.white, 0, 0.32, 0.06, 24); s.scale.z = 1.3;
    box(g, 0.22, 0.15, 0.01, M.white, 0, 1.0, -D / 2 + 0.005);
    return;
  }
  box(g, W, 0.38, 0.2, M.white, 0, 0.6, -D / 2 + 0.1);
  cyl(g, 0.17, 0.13, 0.4, M.white, 0, 0.2, 0.06);
  const s = cyl(g, 0.2, 0.2, 0.04, M.white, 0, 0.42, 0.08); s.scale.z = 1.3;
}

export function basin(g, it) {
  const { w: W, d: D } = it;
  cyl(g, 0.07, 0.1, 0.72, M.white, 0, 0.36, -0.05);
  box(g, W, 0.16, D, M.white, 0, 0.78, 0);
  const bowl = cyl(g, W * 0.32, W * 0.28, 0.01, M.water, 0, 0.865, 0.03, 24); bowl.scale.z = 0.8;
  cyl(g, 0.015, 0.015, 0.16, M.steel, 0, 0.94, -D / 2 + 0.06, 8);
}

export function vanity(g, it, m) {
  const { w: W, d: D } = it;
  box(g, W, 0.62, D, m, 0, 0.18 + 0.31, 0);
  box(g, 0.006, 0.56, 0.006, M.dark, 0, 0.49, D / 2 + 0.003);
  box(g, W, 0.05, D, M.white, 0, 0.825, 0);
  const bowl = cyl(g, 0.2, 0.17, 0.12, M.white, 0, 0.9, 0.03, 24); bowl.scale.z = 0.8;
  cyl(g, 0.015, 0.015, 0.2, M.steel, 0, 0.95, -D / 2 + 0.06, 8);
  box(g, W * 0.85, 0.7, 0.02, M.mirror, 0, 1.55, -D / 2 + 0.01);
}

export function shower(g, it) {
  const { w: W, d: D, h: H } = it;
  box(g, W, 0.05, D, M.white, 0, 0.025, 0);
  const add = (w, d, x, z) => { const p = new THREE.Mesh(new THREE.BoxGeometry(w, H - 0.05, d), M.glass); p.position.set(x, 0.05 + (H - 0.05) / 2, z); g.add(p); };
  add(W, 0.01, 0, D / 2 - 0.005); add(0.01, D, W / 2 - 0.005, 0);
  box(g, W, 0.02, 0.02, M.steel, 0, H, D / 2 - 0.01); box(g, 0.02, 0.02, D, M.steel, W / 2 - 0.01, H, 0);
  box(g, 0.02, H, 0.02, M.steel, W / 2 - 0.01, H / 2, D / 2 - 0.01);
  cyl(g, 0.012, 0.012, 0.3, M.steel, 0, 1.9, -D / 2 + 0.15, 8).rotation.x = Math.PI / 2;
  cyl(g, 0.1, 0.1, 0.015, M.steel, 0, 1.88, -D / 2 + 0.3, 20);
}

export function tub(g, it) {
  const { w: W, d: D } = it;
  box(g, W, 0.55, D, M.white, 0, 0.275, 0);
  const w = box(g, W - 0.14, 0.02, D - 0.14, M.water, 0, 0.5, 0); w.castShadow = false;
  box(g, 0.05, 0.2, 0.05, M.steel, -W / 2 + 0.12, 0.65, 0);
}

export function washer(g, it, m) {
  const { w: W, d: D, h: H } = it;
  box(g, W, H, D, m, 0, H / 2, 0);
  const door = cyl(g, 0.2, 0.2, 0.03, M.dark, 0, H * 0.48, D / 2 + 0.01, 28); door.rotation.x = Math.PI / 2;
  const glass = cyl(g, 0.15, 0.15, 0.035, mat('#5c6b73', { roughness: 0.1, metalness: 0.3 }), 0, H * 0.48, D / 2 + 0.012, 28); glass.rotation.x = Math.PI / 2;
  box(g, W - 0.04, 0.08, 0.01, M.dark, 0, H - 0.07, D / 2 + 0.002);
}
