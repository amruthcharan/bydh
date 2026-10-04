import { SKU } from '../catalog/items.js';
import { distToSeg, wallLen } from './geometry.js';

/**
 * If a wall-snapping item is near a wall, return the position and rotation that
 * put its back flush against that wall (front facing into the room).
 * Plan rotation convention: an item's front points along (−sin a, cos a).
 */
export function wallSnap(plan, item, x, y) {
  if (!item || !item.wallSnap) return null;
  const T = plan.settings.wallT;
  let best = null;
  for (const w of plan.walls) {
    const L = wallLen(w);
    if (L < 0.3) continue;
    const h = distToSeg(x, y, w.x1, w.y1, w.x2, w.y2);
    if (h.t <= 0.001 || h.t >= 0.999) continue;
    const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
    let nx = -uy, ny = ux;
    if ((x - h.qx) * nx + (y - h.qy) * ny < 0) { nx = -nx; ny = -ny; }
    const target = T / 2 + item.d / 2;
    if (h.d < target + 0.35 && (!best || h.d < best.d)) best = { d: h.d, qx: h.qx, qy: h.qy, nx, ny, target };
  }
  if (!best) return null;
  const rot = (Math.round((Math.atan2(-best.nx, best.ny) * 180) / Math.PI) + 360) % 360;
  return { x: best.qx + best.nx * best.target, y: best.qy + best.ny * best.target, rot };
}

export const itemOf = (f) => SKU[f.sku];
