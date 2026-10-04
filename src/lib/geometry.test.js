import { describe, expect, it } from 'vitest';
import { bbox, clamp, connectedEnds, deg, distToSeg, inRotRect, makeId, r2, rad, snapTo, wallLen } from './geometry.js';
import { blankPlan } from './samplePlan.js';

describe('small helpers', () => {
  it('clamp keeps a value inside [a, b]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('snapTo rounds to the nearest grid step', () => {
    expect(snapTo(1.23, 0.05)).toBeCloseTo(1.25);
    expect(snapTo(1.22, 0.05)).toBeCloseTo(1.2);
    expect(snapTo(-0.26, 0.5)).toBeCloseTo(-0.5);
  });

  it('r2 rounds to centimetres', () => {
    expect(r2(1.234)).toBe(1.23);
    expect(r2(1.236)).toBe(1.24);
    expect(r2(2)).toBe(2);
  });

  it('makeId adds a prefix and is unique enough', () => {
    const ids = new Set(Array.from({ length: 200 }, () => makeId('w')));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^w[0-9a-z]{1,7}$/);
  });

  it('wallLen measures a wall', () => {
    expect(wallLen({ x1: 0, y1: 0, x2: 3, y2: 4 })).toBe(5);
    expect(wallLen({ x1: 2, y1: 2, x2: 2, y2: 2 })).toBe(0);
  });

  it('deg and rad convert both ways', () => {
    expect(deg(Math.PI)).toBeCloseTo(180);
    expect(rad(90)).toBeCloseTo(Math.PI / 2);
    expect(deg(rad(37))).toBeCloseTo(37);
  });
});

describe('distToSeg', () => {
  it('projects a point onto the middle of a segment', () => {
    const h = distToSeg(2, 1, 0, 0, 4, 0);
    expect(h.d).toBeCloseTo(1);
    expect(h.t).toBeCloseTo(0.5);
    expect(h.qx).toBeCloseTo(2);
    expect(h.qy).toBeCloseTo(0);
  });

  it('clamps to the nearest end beyond the segment', () => {
    const before = distToSeg(-3, 4, 0, 0, 4, 0);
    expect(before.t).toBe(0);
    expect(before.d).toBeCloseTo(5);
    const after = distToSeg(7, 0, 0, 0, 4, 0);
    expect(after.t).toBe(1);
    expect(after.d).toBeCloseTo(3);
  });

  it('handles a zero-length segment as a point', () => {
    const h = distToSeg(3, 4, 0, 0, 0, 0);
    expect(h.t).toBe(0);
    expect(h.d).toBeCloseTo(5);
  });
});

describe('bbox', () => {
  it('returns a default box for an empty plan', () => {
    expect(bbox(blankPlan())).toEqual({ x0: 0, y0: 0, x1: 10, y1: 8, empty: true });
  });

  it('covers walls, rooms and furniture centres', () => {
    const p = blankPlan();
    p.walls.push({ x1: 1, y1: 1, x2: 5, y2: 1 });
    p.rooms.push({ x: 0, y: 2, w: 3, h: 4 });
    p.furniture.push({ x: 8, y: -1 });
    expect(bbox(p)).toEqual({ x0: 0, y0: -1, x1: 8, y1: 6, empty: false });
  });
});

describe('inRotRect', () => {
  it('tests an unrotated rectangle', () => {
    expect(inRotRect(0.9, 0.4, 0, 0, 2, 1, 0)).toBe(true);
    expect(inRotRect(1.1, 0, 0, 0, 2, 1, 0)).toBe(false);
    expect(inRotRect(0, 0.6, 0, 0, 2, 1, 0)).toBe(false);
  });

  it('swaps width and depth at 90°', () => {
    expect(inRotRect(0, 0.9, 0, 0, 2, 1, 90)).toBe(true);
    expect(inRotRect(0.9, 0, 0, 0, 2, 1, 90)).toBe(false);
  });

  it('grows by the padding', () => {
    expect(inRotRect(1.1, 0, 0, 0, 2, 1, 0, 0.2)).toBe(true);
  });

  it('works off-origin at 45°', () => {
    // A 2 × 0.2 bar centred on (5, 5) and turned 45° covers (5.5, 5.5) but not (5.5, 4.5).
    expect(inRotRect(5.5, 5.5, 5, 5, 2, 0.2, 45)).toBe(true);
    expect(inRotRect(5.5, 4.5, 5, 5, 2, 0.2, 45)).toBe(false);
  });
});

describe('connectedEnds', () => {
  const a = { x1: 0, y1: 0, x2: 4, y2: 0 };
  const b = { x1: 4, y1: 0, x2: 4, y2: 3 };
  const c = { x1: 8, y1: 0, x2: 4, y2: 0 };
  const d = { x1: 4.001, y1: 0, x2: 9, y2: 9 };

  it('finds other walls whose start or end touches the point', () => {
    expect(connectedEnds([a, b, c, d], 4, 0, a)).toEqual([
      [b, 1],
      [c, 2],
    ]);
  });

  it('includes the excluded wall only when it is not excluded', () => {
    expect(connectedEnds([a, b], 4, 0)).toEqual([
      [a, 2],
      [b, 1],
    ]);
  });
});
