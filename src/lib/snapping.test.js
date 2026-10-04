import { describe, expect, it } from 'vitest';
import { itemOf, wallSnap } from './snapping.js';
import { blankPlan } from './samplePlan.js';

// A 10 × 8 m box. Plan y points down, so the north wall is at y = 0.
function box() {
  const p = blankPlan();
  p.settings.wallT = 0.23;
  p.walls.push(
    { id: 'n', x1: 0, y1: 0, x2: 10, y2: 0 },
    { id: 'e', x1: 10, y1: 0, x2: 10, y2: 8 },
    { id: 's', x1: 10, y1: 8, x2: 0, y2: 8 },
    { id: 'w', x1: 0, y1: 8, x2: 0, y2: 0 },
  );
  return p;
}
const item = { wallSnap: true, d: 0.4 };
const flush = 0.23 / 2 + 0.4 / 2; // half wall + half depth

/** The item's front direction for a plan rotation, per the convention in snapping.js. */
const front = (rot) => [-Math.sin((rot * Math.PI) / 180), Math.cos((rot * Math.PI) / 180)];

describe('wallSnap', () => {
  it('returns null for items that do not snap', () => {
    expect(wallSnap(box(), null, 5, 0.3)).toBeNull();
    expect(wallSnap(box(), { wallSnap: false, d: 0.4 }, 5, 0.3)).toBeNull();
  });

  it('returns null when no wall is close enough', () => {
    expect(wallSnap(box(), item, 5, 4)).toBeNull();
    expect(wallSnap(box(), item, 5, flush + 0.36)).toBeNull();
  });

  it('snaps when just inside the capture range', () => {
    expect(wallSnap(box(), item, 5, flush + 0.34)).not.toBeNull();
  });

  it.each([
    ['north', 5, 0.5, { x: 5, y: flush, rot: 0 }],
    ['east', 9.5, 4, { x: 10 - flush, y: 4, rot: 90 }],
    ['south', 5, 7.5, { x: 5, y: 8 - flush, rot: 180 }],
    ['west', 0.5, 4, { x: flush, y: 4, rot: 270 }],
  ])('backs onto the %s wall facing into the room', (_, x, y, want) => {
    const s = wallSnap(box(), item, x, y);
    expect(s.x).toBeCloseTo(want.x);
    expect(s.y).toBeCloseTo(want.y);
    expect(s.rot).toBe(want.rot);
    // The front points away from the wall, towards the room centre (5, 4).
    const [fx, fy] = front(s.rot);
    expect(fx * (5 - s.x) + fy * (4 - s.y)).toBeGreaterThan(0);
  });

  it('faces away from the wall on the outside too', () => {
    const s = wallSnap(box(), item, 5, -0.5);
    expect(s.y).toBeCloseTo(-flush);
    expect(s.rot).toBe(180);
  });

  it('picks the nearest wall in a corner', () => {
    const s = wallSnap(box(), item, 0.6, 0.4);
    expect(s.rot).toBe(0);
    expect(s.y).toBeCloseTo(flush);
  });

  it('ignores a point that projects onto a wall end', () => {
    const p = blankPlan();
    p.walls.push({ id: 'n', x1: 0, y1: 0, x2: 10, y2: 0 });
    expect(wallSnap(p, item, -0.1, 0.3)).toBeNull();
    expect(wallSnap(p, item, 10.1, 0.3)).toBeNull();
  });

  it('ignores walls shorter than 30 cm', () => {
    const p = blankPlan();
    p.walls.push({ id: 'stub', x1: 0, y1: 0, x2: 0.29, y2: 0 });
    expect(wallSnap(p, item, 0.15, 0.3)).toBeNull();
  });

  it('handles an angled wall', () => {
    const p = blankPlan();
    p.walls.push({ id: 'd', x1: 0, y1: 0, x2: 6, y2: 6 });
    const s = wallSnap(p, item, 3.2, 2.8);
    // Centre sits `flush` metres from the wall line x = y, on the side of the click.
    expect(Math.abs(s.x - s.y) / Math.SQRT2).toBeCloseTo(flush);
    expect(s.x).toBeGreaterThan(s.y);
    expect(s.rot).toBe(225);
    const [fx, fy] = front(s.rot);
    expect(fx).toBeCloseTo(Math.SQRT1_2);
    expect(fy).toBeCloseTo(-Math.SQRT1_2);
  });

  it('follows the wall thickness setting', () => {
    const p = box();
    p.settings.wallT = 0.115;
    expect(wallSnap(p, item, 5, 0.5).y).toBeCloseTo(0.115 / 2 + 0.2);
  });
});

describe('itemOf', () => {
  it('looks up the catalogue entry for a placed item', () => {
    expect(itemOf({ sku: 'BD-KING' }).name).toMatch(/King bed/);
    expect(itemOf({ sku: 'NOPE' })).toBeUndefined();
  });
});
