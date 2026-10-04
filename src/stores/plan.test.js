import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { blankPlan } from '../lib/samplePlan.js';
import { wallLen } from '../lib/geometry.js';
import { usePlanStore } from './plan.js';

// Autosave goes to IndexedDB, which Node lacks.
vi.mock('idb-keyval', () => ({ get: vi.fn(async () => undefined), set: vi.fn(async () => {}) }));

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = usePlanStore();
  store.load(blankPlan());
});

const walls = () => store.plan.walls;
const segs = () => walls().map((w) => [w.x1, w.y1, w.x2, w.y2]);

describe('addRoom', () => {
  it('adds the room and its four walls, then commits', () => {
    const rev = store.rev;
    const r = store.addRoom(0, 0, 4, 3);
    expect(store.plan.rooms).toEqual([{ id: r.id, name: 'Room 1', x: 0, y: 0, w: 4, h: 3, floor: 'vitrified' }]);
    expect(segs()).toEqual([
      [0, 0, 4, 0],
      [4, 0, 4, 3],
      [4, 3, 0, 3],
      [0, 3, 0, 0],
    ]);
    expect(store.rev).toBeGreaterThan(rev);
    expect(store.canUndo).toBe(true);
  });

  it('numbers rooms in order', () => {
    store.addRoom(0, 0, 4, 3);
    expect(store.addRoom(4, 0, 8, 3).name).toBe('Room 2');
  });

  it('rounds the size to centimetres', () => {
    const r = store.addRoom(0.1, 0.1, 3.456, 2.001);
    expect(r.w).toBe(3.36);
    expect(r.h).toBe(1.9);
  });

  it('skips a shared edge with a neighbouring room', () => {
    store.addRoom(0, 0, 4, 3);
    store.addRoom(4, 0, 8, 3);
    expect(walls()).toHaveLength(7);
    expect(segs().filter(([x1, , x2]) => x1 === 4 && x2 === 4)).toHaveLength(1);
  });

  it('skips an edge that lies inside a longer existing wall', () => {
    store.addRoom(0, 0, 8, 3);
    store.addRoom(2, 3, 5, 6);
    expect(walls()).toHaveLength(7);
  });

  it('adds an edge that only partly overlaps an existing wall', () => {
    store.addRoom(0, 0, 4, 3);
    store.addRoom(2, 3, 6, 6); // top edge 2→6 runs past the 0→4 wall
    expect(walls()).toHaveLength(8);
  });

  it('treats walls within 2 cm as covering', () => {
    store.addWall(0, 0.015, 4, 0.015);
    store.addRoom(0, 0, 4, 3);
    expect(walls()).toHaveLength(4);
  });

  it('does not treat walls 3 cm away as covering', () => {
    store.addWall(0, 0.03, 4, 0.03);
    store.addRoom(0, 0, 4, 3);
    expect(walls()).toHaveLength(5);
  });

  it('known gap: adds a full wall when an edge is covered by two collinear walls together', () => {
    store.addRoom(0, 0, 4, 3);
    store.addRoom(4, 0, 8, 3);
    store.addRoom(0, 3, 8, 6); // top edge 0→8 is already covered by 0→4 and 4→8
    // Current behaviour: no single wall covers both ends, so an overlapping 8 m wall is added.
    expect(segs().filter(([, y1, , y2]) => y1 === 3 && y2 === 3)).toHaveLength(3);
  });
});

describe('setWallLength', () => {
  it('extends the wall from its start point', () => {
    const w = store.addWall(1, 1, 5, 1);
    store.setWallLength(w, 6);
    expect([w.x1, w.y1, w.x2, w.y2]).toEqual([1, 1, 7, 1]);
  });

  it('keeps the direction of an angled wall', () => {
    const w = store.addWall(0, 0, 3, 4);
    store.setWallLength(w, 10);
    expect([w.x2, w.y2]).toEqual([6, 8]);
  });

  it('drags walls connected to the end point, not the start point', () => {
    const w = store.addWall(0, 0, 4, 0);
    const atEnd = store.addWall(4, 0, 4, 3);
    const intoEnd = store.addWall(4, 5, 4, 0);
    const atStart = store.addWall(0, 0, 0, 3);
    store.setWallLength(w, 5);
    expect([atEnd.x1, atEnd.y1]).toEqual([5, 0]);
    expect([intoEnd.x2, intoEnd.y2]).toEqual([5, 0]);
    expect([atStart.x1, atStart.y1]).toEqual([0, 0]);
  });

  it('keeps openings at the same distance from the start', () => {
    const w = store.addWall(0, 0, 4, 0);
    store.plan.openings.push({ id: 'o', wall: w.id, t: 0.5, w: 0.9 });
    store.setWallLength(w, 8);
    expect(store.plan.openings[0].t * 8).toBeCloseTo(2);
  });

  it('pulls openings back onto a shortened wall', () => {
    const w = store.addWall(0, 0, 4, 0);
    store.plan.openings.push({ id: 'o', wall: w.id, t: 0.8, w: 0.9 });
    store.setWallLength(w, 3);
    expect(store.plan.openings[0].t).toBeCloseTo(1 - 0.45 / 3);
  });

  it('clamps the length to 0.25–60 m', () => {
    const w = store.addWall(0, 0, 4, 0);
    store.setWallLength(w, 0.1);
    expect(wallLen(w)).toBeCloseTo(0.25);
    store.setWallLength(w, 100);
    expect(wallLen(w)).toBeCloseTo(60);
  });

  it('ignores a zero-length wall', () => {
    const w = store.addWall(2, 2, 2, 2);
    store.setWallLength(w, 3);
    expect([w.x2, w.y2]).toEqual([2, 2]);
  });

  it('touches but leaves the commit to the caller', () => {
    const w = store.addWall(0, 0, 4, 0);
    store.commit();
    const rev = store.rev;
    store.setWallLength(w, 5);
    expect(store.rev).toBeGreaterThan(rev);
    store.undo(); // undo goes back to before addWall, because setWallLength did not commit
    expect(walls()).toHaveLength(0);
  });
});

describe('splitWall', () => {
  it('splits a wall at its midpoint and commits', () => {
    const w = store.addWall(0, 0, 4, 2);
    store.commit();
    store.splitWall(w);
    expect(segs()).toEqual([
      [0, 0, 2, 1],
      [2, 1, 4, 2],
    ]);
    store.undo();
    expect(segs()).toEqual([[0, 0, 4, 2]]);
  });

  it('moves openings to the half they sit in, keeping their position', () => {
    const w = store.addWall(0, 0, 4, 0);
    store.plan.openings.push({ id: 'a', wall: w.id, t: 0.25, w: 0.9 }, { id: 'b', wall: w.id, t: 0.75, w: 0.9 });
    store.splitWall(w);
    const n = walls()[1];
    const [a, b] = store.plan.openings;
    expect(a.wall).toBe(w.id);
    expect(a.t).toBeCloseTo(0.5);
    expect(b.wall).toBe(n.id);
    expect(b.t).toBeCloseTo(0.5);
  });

  it('leaves other walls joined to the far end untouched', () => {
    const w = store.addWall(0, 0, 4, 0);
    const side = store.addWall(4, 0, 4, 3);
    store.splitWall(w);
    const n = walls()[2];
    expect([n.x1, n.x2]).toEqual([2, 4]);
    expect([side.x1, side.y1]).toEqual([4, 0]);
  });
});

describe('calibrate', () => {
  beforeEach(() => store.setUnderlay({ src: 'data:image/jpeg;base64,', w: 1000, h: 800 }));

  it('places a new image over an empty plan', () => {
    const u = store.plan.underlay;
    expect(u).toMatchObject({ mpp: 0.014, x: 7, opacity: 0.55 });
    expect(u.y).toBeCloseTo(5.6);
    expect(store.sel).toEqual({ kind: 'underlay', id: 'underlay' });
  });

  it('scales the image about the first point and commits', () => {
    const rev = store.rev;
    expect(store.calibrate({ x: 1, y: 1 }, { x: 3, y: 1 }, 4)).toBe(true);
    const u = store.plan.underlay;
    expect(u.mpp).toBeCloseTo(0.028);
    expect(u.x).toBeCloseTo(13);
    expect(u.y).toBeCloseTo(10.2);
    expect(store.rev).toBeGreaterThan(rev);
    store.undo();
    expect(store.plan.underlay.mpp).toBeCloseTo(0.014);
  });

  it.each([
    ['the points coincide', { x: 1, y: 1 }, 4],
    ['the length is zero', { x: 3, y: 1 }, 0],
    ['the length is negative', { x: 3, y: 1 }, -2],
    ['the length is not a number', { x: 3, y: 1 }, NaN],
  ])('refuses when %s', (_, p2, real) => {
    const rev = store.rev;
    expect(store.calibrate({ x: 1, y: 1 }, p2, real)).toBe(false);
    expect(store.plan.underlay.mpp).toBe(0.014);
    expect(store.rev).toBe(rev);
  });

  it('marks the image as calibrated', () => {
    expect(store.plan.underlay.calibrated).toBeFalsy();
    store.calibrate({ x: 1, y: 1 }, { x: 3, y: 1 }, 4);
    expect(store.plan.underlay.calibrated).toBe(true);
  });

  it('refuses without an image', () => {
    store.load(blankPlan());
    expect(store.calibrate({ x: 0, y: 0 }, { x: 1, y: 0 }, 1)).toBe(false);
  });
});

describe('addDetected', () => {
  const found = {
    walls: [
      { x1: 0, y1: 0, x2: 4.004, y2: 0 },
      { x1: 4.004, y1: 0, x2: 4.004, y2: 3 },
    ],
    openings: [
      { wall: 0, t: 0.5, w: 0.9, type: 'door' },
      { wall: 1, t: 0.5, w: 1.5, type: 'window' },
      { wall: 7, t: 0.5, w: 1, type: 'door' },
    ],
    rooms: [{ x: 0, y: 0, w: 4, h: 3 }],
    wallT: 0.15,
  };

  it('adds everything as one undo step', () => {
    store.addDetected(found);
    expect(walls()).toHaveLength(2);
    expect(store.plan.rooms).toEqual([{ id: expect.any(String), name: 'Room 1', x: 0, y: 0, w: 4, h: 3, floor: 'vitrified' }]);
    store.undo();
    expect(walls()).toHaveLength(0);
    expect(store.plan.rooms).toHaveLength(0);
  });

  it('rounds to centimetres and keeps shared corners joined', () => {
    store.addDetected(found);
    const [a, b] = walls();
    expect([a.x2, a.y2]).toEqual([4, 0]);
    expect([b.x1, b.y1]).toEqual([a.x2, a.y2]);
  });

  it('links openings to their walls and skips ones with no wall', () => {
    store.addDetected(found);
    const [a, b] = walls();
    expect(store.plan.openings).toHaveLength(2);
    expect(store.plan.openings[0]).toMatchObject({ wall: a.id, type: 'door', h: 2.1 });
    expect(store.plan.openings[1]).toMatchObject({ wall: b.id, type: 'window', h: 1.2, sill: 0.9 });
  });

  it('sets the wall thickness only on an empty plan', () => {
    store.addDetected(found);
    expect(store.plan.settings.wallT).toBe(0.15);
    store.addDetected({ ...found, wallT: 0.3 });
    expect(store.plan.settings.wallT).toBe(0.15);
  });

  it('adds alongside existing walls, or replaces them', () => {
    store.addRoom(10, 10, 12, 12);
    store.addDetected(found);
    expect(walls()).toHaveLength(6);
    store.addDetected(found, { replace: true });
    expect(walls()).toHaveLength(2);
    expect(store.plan.rooms).toHaveLength(1);
  });
});

describe('undo and redo', () => {
  it('starts with nothing to undo or redo after a load', () => {
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
  });

  it('steps back and forward through commits', () => {
    store.addRoom(0, 0, 4, 3);
    store.addRoom(4, 0, 8, 3);
    store.undo();
    expect(store.plan.rooms).toHaveLength(1);
    expect(store.canRedo).toBe(true);
    store.undo();
    expect(store.plan.rooms).toHaveLength(0);
    expect(store.canUndo).toBe(false);
    store.redo();
    store.redo();
    expect(store.plan.rooms).toHaveLength(2);
    expect(store.canRedo).toBe(false);
  });

  it('bumps rev on undo and redo so the 3D view rebuilds', () => {
    store.addRoom(0, 0, 4, 3);
    let rev = store.rev;
    store.undo();
    expect(store.rev).toBeGreaterThan(rev);
    rev = store.rev;
    store.redo();
    expect(store.rev).toBeGreaterThan(rev);
  });

  it('does nothing at either end of history', () => {
    const rev = store.rev;
    store.undo();
    store.redo();
    expect(store.rev).toBe(rev);
  });

  it('drops the redo branch after a new edit', () => {
    store.addRoom(0, 0, 4, 3);
    store.undo();
    store.addWall(0, 0, 1, 0);
    store.commit();
    expect(store.canRedo).toBe(false);
    expect(store.plan.rooms).toHaveLength(0);
  });

  it('ignores a commit with no changes', () => {
    store.addRoom(0, 0, 4, 3);
    store.commit();
    store.commit();
    store.undo();
    expect(store.plan.rooms).toHaveLength(0);
  });

  it('collects a drag into one undo step', () => {
    const w = store.addWall(0, 0, 4, 0);
    store.commit();
    for (const x of [4.1, 4.2, 4.3]) {
      w.x2 = x;
      store.touch();
    }
    store.commit();
    store.undo();
    expect(walls()[0].x2).toBe(4);
  });

  it('restores a copy, so later edits do not rewrite history', () => {
    store.addRoom(0, 0, 4, 3);
    store.addRoom(4, 0, 8, 3);
    store.undo();
    store.plan.rooms[0].name = 'Changed';
    store.redo();
    store.undo();
    expect(store.plan.rooms[0].name).toBe('Room 1');
  });

  it('clears the selection when the selected object is undone away', () => {
    const r = store.addRoom(0, 0, 4, 3);
    store.select({ kind: 'room', id: r.id });
    store.undo();
    expect(store.sel).toBeNull();
  });

  it('keeps the selection when the object survives the undo', () => {
    const r = store.addRoom(0, 0, 4, 3);
    store.addWall(9, 9, 10, 9);
    store.commit();
    store.select({ kind: 'room', id: r.id });
    store.undo();
    expect(store.sel).toEqual({ kind: 'room', id: r.id });
  });

  it('keeps at most 100 steps', () => {
    for (let i = 0; i < 110; i++) {
      store.addWall(i, 0, i + 1, 0);
      store.commit();
    }
    let steps = 0;
    while (store.canUndo) {
      store.undo();
      steps++;
    }
    expect(steps).toBe(99);
    expect(walls()).toHaveLength(11);
  });
});
