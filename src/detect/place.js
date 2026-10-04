// Move detection results from image metres onto the plan, using the tracing image's
// position, scale and rotation.

import { rad } from '../lib/geometry.js';

/**
 * `result` is in image metres over a working image `imgW` × `imgH` metres that covers the whole
 * underlay. Returns walls, openings and rooms in plan metres. Rooms are only kept when the image
 * is turned a multiple of 90°, because plan rooms are axis-aligned rectangles.
 */
export function toPlan(result, u, imgW, imgH) {
  const kx = (u.w * u.mpp) / imgW,
    ky = (u.h * u.mpp) / imgH;
  const a = rad(u.rot || 0),
    cos = Math.cos(a),
    sin = Math.sin(a);
  const map = (x, y) => {
    const lx = x * kx - (u.w * u.mpp) / 2,
      ly = y * ky - (u.h * u.mpp) / 2;
    return [u.x + lx * cos - ly * sin, u.y + lx * sin + ly * cos];
  };
  const walls = result.walls.map((w) => {
    const [x1, y1] = map(w.x1, w.y1),
      [x2, y2] = map(w.x2, w.y2);
    return { x1, y1, x2, y2 };
  });
  const square = Math.abs(((((u.rot || 0) % 90) + 135) % 90) - 45) < 0.5;
  const rooms = square
    ? result.rooms.map((r) => {
        const [ax, ay] = map(r.x, r.y),
          [bx, by] = map(r.x + r.w, r.y + r.h);
        return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
      })
    : [];
  const openings = result.openings.map((o) => ({ ...o, w: o.w * kx }));
  return { walls, openings, rooms, skippedRooms: (result.skippedRooms || 0) + (square ? 0 : result.rooms.length), wallT: result.wallT * kx };
}
