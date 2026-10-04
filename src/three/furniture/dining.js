import * as THREE from 'three';
import { M, box, cyl, mat, tint } from '../parts.js';

export function chair(g, x, z, rotY, m, seat) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = rotY; g.add(c);
  box(c, 0.42, 0.05, 0.42, seat || m, 0, 0.46, 0);
  box(c, 0.42, 0.45, 0.04, m, 0, 0.7, -0.19);
  for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) box(c, 0.03, 0.44, 0.03, m, lx, 0.22, lz);
  return c;
}

export function dining(g, it, m) {
  const { w: W, d: D, h: H } = it, p = it.params, seat = mat(tint(it._color, '#E8E3D8', 0.6));
  if (p.round) {
    cyl(g, 0.55, 0.55, 0.04, m, 0, H - 0.02, 0, 40);
    cyl(g, 0.05, 0.05, H - 0.04, m, 0, (H - 0.04) / 2, 0, 12);
    cyl(g, 0.28, 0.3, 0.03, m, 0, 0.015, 0, 24);
    for (let i = 0; i < (p.seats || 4); i++) {
      const a = (i / (p.seats || 4)) * Math.PI * 2 + Math.PI / 4;
      chair(g, Math.sin(a) * 0.66, Math.cos(a) * 0.66, a + Math.PI, m, seat);
    }
    return;
  }
  const tw = W - 0.4, td = 0.85;
  box(g, tw, 0.04, td, m, 0, H - 0.02, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.05, H - 0.04, 0.05, m, sx * (tw / 2 - 0.06), (H - 0.04) / 2, sz * (td / 2 - 0.06));
  const per = (p.seats || 4) / 2;
  for (let i = 0; i < per; i++) {
    const x = -tw / 2 + (tw / per) * (i + 0.5);
    chair(g, x, D / 2 - 0.2, Math.PI, m, seat);
    chair(g, x, -D / 2 + 0.2, 0, m, seat);
  }
}

export function crockery(g, it, m) {
  const { w: W, d: D, h: H } = it;
  box(g, W, 0.85, D, m, 0, 0.425, 0);
  box(g, 0.006, 0.8, 0.006, M.dark, 0, 0.425, D / 2 + 0.003);
  box(g, W + 0.02, 0.03, D + 0.02, mat(tint(it._color, '#000000', 0.2)), 0, 0.865, 0);
  const uh = H - 0.88, ud = D * 0.7;
  box(g, W, uh, 0.02, m, 0, 0.88 + uh / 2, -D / 2 + 0.01);
  for (const sx of [-1, 1]) box(g, 0.03, uh, ud, m, sx * (W / 2 - 0.015), 0.88 + uh / 2, -D / 2 + ud / 2);
  box(g, W, 0.03, ud, m, 0, H - 0.015, -D / 2 + ud / 2);
  for (const y of [0.88 + uh * 0.36, 0.88 + uh * 0.68]) box(g, W - 0.06, 0.012, ud - 0.02, M.glass, 0, y, -D / 2 + ud / 2);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, uh - 0.04, 0.01), M.glass); gl.position.set(0, 0.88 + uh / 2, -D / 2 + ud); g.add(gl);
  for (let i = 0; i < 4; i++) cyl(g, 0.09, 0.09, 0.015, M.white, -W / 2 + 0.2 + i * ((W - 0.4) / 3), 0.88 + uh * 0.36 + 0.09, -D / 2 + 0.1, 20).rotation.x = Math.PI / 2;
}
