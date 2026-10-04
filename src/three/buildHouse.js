import * as THREE from 'three';
import { SKU } from '../catalog/items.js';
import { bbox, clamp, rad, wallLen } from '../lib/geometry.js';
import { M, box } from './parts.js';
import { texture, FLOOR_TILE_SIZE } from './textures.js';
import { buildFurnitureModel } from './furniture/index.js';

export const PLINTH_H = 0.45;

const tag = (obj, pick) => obj.traverse((o) => { if (o.isMesh) o.userData.pick = pick; });

function buildWall(plan, w, parent, objMap) {
  const L = wallLen(w); if (L < 0.05) return;
  const T = plan.settings.wallT, H = plan.settings.wallH;
  const g = new THREE.Group();
  g.position.set(w.x1, 0, w.y1); g.rotation.y = -Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
  parent.add(g); objMap.set(w.id, g);
  const ops = plan.openings.filter((o) => o.wall === w.id)
    .map((o) => ({ o, a: o.t * L - o.w / 2, b: o.t * L + o.w / 2 })).sort((p, q) => p.a - q.a);
  let cur = -T / 2;
  const seg = (a, b, y0, y1) => { if (b - a > 0.004 && y1 - y0 > 0.004) box(g, b - a, y1 - y0, T, M.wall, (a + b) / 2, (y0 + y1) / 2, 0); };
  for (const p of ops) {
    const a = clamp(p.a, cur, L), b = clamp(p.b, a, L);
    seg(cur, a, 0, H);
    const og = new THREE.Group(); g.add(og); objMap.set(p.o.id, og);
    if (p.o.type === 'door') {
      const dh = Math.min(p.o.h, H - 0.02); seg(a, b, dh, H);
      box(og, 0.05, dh, T + 0.02, M.frame, a + 0.025, dh / 2, 0);
      box(og, 0.05, dh, T + 0.02, M.frame, b - 0.025, dh / 2, 0);
      box(og, b - a, 0.05, T + 0.02, M.frame, (a + b) / 2, dh - 0.025, 0);
      // The leaf runs along +x from a hinge at `a`, or along −x from a hinge at `b` (hingeEnd).
      const sd = p.o.flip ? -1 : 1, dir = p.o.hingeEnd ? -1 : 1, lw = b - a - 0.1, piv = new THREE.Group();
      piv.position.set(p.o.hingeEnd ? b - 0.05 : a + 0.05, 0, sd * (T / 2 - 0.03)); piv.rotation.y = -sd * dir * 1.4; og.add(piv);
      box(piv, lw, dh - 0.06, 0.04, M.door, (dir * lw) / 2, (dh - 0.06) / 2 + 0.01, 0);
      box(piv, 0.12, 0.025, 0.06, M.steel, dir * (lw - 0.1), 1.0, 0).castShadow = false;
    } else {
      const s = Math.min(p.o.sill, H - 0.3), wh = Math.min(p.o.h, H - s - 0.02), fd = T * 0.55;
      seg(a, b, 0, s); seg(a, b, s + wh, H);
      box(og, b - a, 0.05, fd, M.frame, (a + b) / 2, s + 0.025, 0);
      box(og, b - a, 0.05, fd, M.frame, (a + b) / 2, s + wh - 0.025, 0);
      box(og, 0.05, wh, fd, M.frame, a + 0.025, s + wh / 2, 0);
      box(og, 0.05, wh, fd, M.frame, b - 0.025, s + wh / 2, 0);
      if (b - a > 0.9) box(og, 0.04, wh, fd, M.frame, (a + b) / 2, s + wh / 2, 0);
      if (s > 0) box(og, b - a + 0.04, 0.04, T + 0.06, M.frame, (a + b) / 2, s - 0.02, 0);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(b - a - 0.06, wh - 0.06, 0.012), M.glass);
      gl.position.set((a + b) / 2, s + wh / 2, 0); og.add(gl);
    }
    tag(og, { kind: 'opening', id: p.o.id });
    cur = b;
  }
  seg(cur, L + T / 2, 0, H);
  g.children.forEach((c) => { if (c.isMesh && !c.userData.pick) c.userData.pick = { kind: 'wall', id: w.id }; });
}

const underlayTex = { src: null, tex: null };

/** Build the full house as a Group. Returns { root, objMap } where objMap maps plan ids to objects. */
export function buildHouse(plan) {
  const root = new THREE.Group(), objMap = new Map();
  const b = bbox(plan);
  if (!b.empty) {
    const pad = plan.settings.wallT / 2 + 0.35;
    const pl = box(root, b.x1 - b.x0 + pad * 2, PLINTH_H, b.y1 - b.y0 + pad * 2, M.plinth, (b.x0 + b.x1) / 2, -PLINTH_H / 2, (b.y0 + b.y1) / 2);
    pl.userData.noExport = false;
  }
  plan.rooms.forEach((r, i) => {
    const t = texture(r.floor || 'vitrified').clone(); t.needsUpdate = true;
    const sz = FLOOR_TILE_SIZE[r.floor] || 1.2; t.repeat.set(r.w / sz, r.h / sz);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), new THREE.MeshStandardMaterial({ map: t, roughness: ['marble', 'vitrified', 'granite'].includes(r.floor) ? 0.35 : 0.8 }));
    m.rotation.x = -Math.PI / 2; m.position.set(r.x + r.w / 2, 0.006 + (i % 5) * 0.0008, r.y + r.h / 2);
    m.receiveShadow = true; m.userData.pick = { kind: 'room', id: r.id }; m.userData.ownsMaterial = true;
    root.add(m); objMap.set(r.id, m);
  });
  for (const w of plan.walls) buildWall(plan, w, root, objMap);
  for (const f of plan.furniture) {
    const it = SKU[f.sku]; if (!it) continue;
    const g = buildFurnitureModel(it, f.color);
    g.position.set(f.x, 0, f.y); g.rotation.y = -rad(f.rot);
    tag(g, { kind: 'furniture', id: f.id });
    root.add(g); objMap.set(f.id, g);
  }
  const u = plan.underlay;
  if (u && u.visible && u.show3D) {
    if (underlayTex.src !== u.src) {
      underlayTex.tex?.dispose();
      underlayTex.tex = new THREE.TextureLoader().load(u.src); underlayTex.tex.colorSpace = THREE.SRGBColorSpace; underlayTex.src = u.src;
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(u.w * u.mpp, u.h * u.mpp), new THREE.MeshBasicMaterial({ map: underlayTex.tex, transparent: true, opacity: Math.max(0.35, u.opacity), depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -rad(u.rot); m.position.set(u.x, 0.004, u.y);
    m.userData.ownsMaterial = true; m.userData.noExport = true; root.add(m);
  }
  return { root, objMap };
}

/** Free geometries (shared materials are kept; per-room materials are disposed). */
export function disposeHouse(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    if (o.userData.ownsMaterial) { o.material.map && o.material.map !== underlayTex.tex && o.material.map.dispose(); o.material.dispose(); }
  });
}
