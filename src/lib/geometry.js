export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const snapTo = (v, g) => Math.round(v / g) * g;
export const r2 = (v) => Math.round(v * 100) / 100;
export const makeId = (p) => p + Math.random().toString(36).slice(2, 9);
export const wallLen = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;

/** Distance from a point to a segment, with the clamped parameter t and the closest point. */
export function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0;
  t = clamp(t, 0, 1);
  const qx = x1 + t * dx, qy = y1 + t * dy;
  return { d: Math.hypot(px - qx, py - qy), t, qx, qy };
}

/** Bounding box of walls, rooms and furniture (plan metres). */
export function bbox(plan) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  plan.walls.forEach((w) => { add(w.x1, w.y1); add(w.x2, w.y2); });
  plan.rooms.forEach((r) => { add(r.x, r.y); add(r.x + r.w, r.y + r.h); });
  plan.furniture.forEach((f) => add(f.x, f.y));
  if (x0 === Infinity) return { x0: 0, y0: 0, x1: 10, y1: 8, empty: true };
  return { x0, y0, x1, y1, empty: false };
}

/** Point-in-rotated-rectangle test. Rotation in degrees, plan coordinates (y down). */
export function inRotRect(x, y, cx, cy, w, d, rotDeg, pad = 0) {
  const a = -rad(rotDeg), dx = x - cx, dy = y - cy;
  const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= w / 2 + pad && Math.abs(ly) <= d / 2 + pad;
}

/** Endpoints of other walls that coincide with (x, y). */
export function connectedEnds(walls, x, y, exclude) {
  const out = [];
  for (const w of walls) {
    if (w === exclude) continue;
    if (Math.hypot(w.x1 - x, w.y1 - y) < 1e-4) out.push([w, 1]);
    if (Math.hypot(w.x2 - x, w.y2 - y) < 1e-4) out.push([w, 2]);
  }
  return out;
}
