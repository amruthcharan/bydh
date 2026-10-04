import { describe, expect, it } from 'vitest';
import { extendEnds, findRooms, joinEnds, linesInGap, mergeCollinear, DEFAULTS, simplify, snapAxes, thin, trace, vectorize } from './vectorize.js';

const RES = 0.025; // metres per pixel

/** A blank mask big enough for a plan of wM × hM metres plus a 1 m margin. */
function canvas(wM, hM) {
  const W = Math.ceil((wM + 2) / RES),
    H = Math.ceil((hM + 2) / RES);
  return { W, H, m: new Uint8Array(W * H) };
}
/** Paint a wall of thickness T along a horizontal or vertical centre line (metres, 1 m margin). */
function wall(c, x1, y1, x2, y2, T = 0.23) {
  const px = (v) => Math.round((v + 1) / RES);
  const xa = px(Math.min(x1, x2) - (y1 === y2 ? T / 2 : T / 2)),
    xb = px(Math.max(x1, x2) + T / 2);
  const ya = px(Math.min(y1, y2) - T / 2),
    yb = px(Math.max(y1, y2) + T / 2);
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) c.m[y * c.W + x] = 1;
}
/** Shift results back by the 1 m margin. */
const shift = (w) => ({ x1: w.x1 - 1, y1: w.y1 - 1, x2: w.x2 - 1, y2: w.y2 - 1 });
const near = (a, b, tol = 0.06) => Math.abs(a - b) <= tol;
const hasWall = (walls, x1, y1, x2, y2, tol) =>
  walls.some(
    (w) =>
      (near(w.x1, x1, tol) && near(w.y1, y1, tol) && near(w.x2, x2, tol) && near(w.y2, y2, tol)) ||
      (near(w.x1, x2, tol) && near(w.y1, y2, tol) && near(w.x2, x1, tol) && near(w.y2, y1, tol)),
  );

describe('thin and trace', () => {
  it('reduces a thick bar to a one-pixel line along its centre', () => {
    const W = 60,
      H = 20,
      m = new Uint8Array(W * H);
    for (let y = 6; y < 14; y++) for (let x = 5; x < 55; x++) m[y * W + x] = 1;
    const s = thin(m, W, H);
    const ys = new Set();
    for (let i = 0; i < s.length; i++) if (s[i]) ys.add((i / W) | 0);
    expect([...ys].every((y) => y >= 8 && y <= 11)).toBe(true);
    const paths = trace(s, W, H);
    const longest = paths.reduce((a, p) => (p.length > a.length ? p : a), []);
    expect(longest.length).toBeGreaterThan(35);
  });
});

describe('simplify', () => {
  it('keeps corners and drops points on straight runs', () => {
    const pts = [];
    for (let x = 0; x <= 10; x++) pts.push([x, 0]);
    for (let y = 1; y <= 10; y++) pts.push([10, y]);
    expect(simplify(pts, 1)).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
  });
});

describe('snapAxes', () => {
  it('straightens near-horizontal and near-vertical segments and leaves diagonals', () => {
    const [h, v, d] = snapAxes(
      [
        { x1: 0, y1: 0, x2: 4, y2: 0.1 },
        { x1: 1, y1: 0, x2: 1.1, y2: 3 },
        { x1: 0, y1: 0, x2: 3, y2: 3 },
      ],
      4,
    );
    expect(h.y1).toBe(h.y2);
    expect(v.x1).toBe(v.x2);
    expect(d).toEqual({ x1: 0, y1: 0, x2: 3, y2: 3 });
  });
});

describe('mergeCollinear', () => {
  it('closes small gaps and turns door-sized gaps into openings', () => {
    const out = mergeCollinear(
      [
        { x1: 0, y1: 0, x2: 2, y2: 0 },
        { x1: 2.1, y1: 0.02, x2: 3, y2: 0.02 },
        { x1: 3.9, y1: 0, x2: 6, y2: 0 },
        { x1: 10, y1: 0, x2: 11, y2: 0 }, // 4 m away: too wide to be an opening
      ],
      DEFAULTS,
    );
    expect(out).toHaveLength(2);
    const main = out.find((w) => w.x1 === 0);
    expect(main.x2).toBe(6);
    expect(main.openings).toHaveLength(1);
    expect(main.openings[0].cx).toBeCloseTo(3.45);
    expect(main.openings[0].w).toBeCloseTo(0.9);
  });
});

describe('joinEnds', () => {
  it('closes an L corner and a T junction', () => {
    const walls = joinEnds(
      [
        { x1: 0, y1: 0, x2: 3.9, y2: 0 },
        { x1: 4, y1: 0.1, x2: 4, y2: 3 },
        { x1: 2, y1: 0.12, x2: 2, y2: 3 },
      ],
      0.25,
    );
    expect([walls[0].x2, walls[0].y2]).toEqual([4, 0]);
    expect([walls[1].x1, walls[1].y1]).toEqual([4, 0]);
    expect([walls[2].x1, walls[2].y1]).toEqual([2, 0]);
  });
});

describe('extendEnds', () => {
  it('extends a free end across a door-sized gap to the wall it points at, as an opening', () => {
    const walls = extendEnds(
      [
        { x1: 0, y1: 0, x2: 0, y2: 4 },
        { x1: 4, y1: 2, x2: 0.9, y2: 2 },
      ],
      0.5,
      1.25,
    );
    expect([walls[1].x2, walls[1].y2]).toEqual([0, 2]);
    expect(walls[1].openings).toEqual([{ cx: 0.45, cy: 2, w: 0.9 }]);
  });

  it('closes a small gap without an opening and leaves wide gaps alone', () => {
    const walls = extendEnds(
      [
        { x1: 0, y1: 0, x2: 0, y2: 4 },
        { x1: 4, y1: 1, x2: 0.2, y2: 1 },
        { x1: 4, y1: 3, x2: 2, y2: 3 },
      ],
      0.5,
      1.25,
    );
    expect(walls[1].x2).toBe(0);
    expect(walls[1].openings).toBeUndefined();
    expect(walls[2].x2).toBe(2);
  });
});

describe('linesInGap', () => {
  // A 2 m × 1 m white page at 1 cm/px with a horizontal wall gap centred on (1, 0.5).
  const W = 200,
    H = 100,
    res = 0.01;
  const blank = () => new Uint8Array(W * H).fill(255);

  it('sees window lines drawn across the gap', () => {
    const g = blank();
    for (const y of [46, 50, 54]) for (let x = 55; x < 145; x++) g[y * W + x] = 30;
    expect(linesInGap(g, W, H, res, 1, 0.5, 1, 0, 0.9, 0.23)).toBe(true);
  });

  it('treats an empty gap with a swing arc beside it as a door', () => {
    const g = blank();
    for (let a = 0; a < Math.PI / 2; a += 0.005) {
      const x = Math.round(55 + Math.cos(a) * 90),
        y = Math.round(62 + Math.sin(a) * 30);
      if (y < H) g[y * W + x] = 30;
    }
    expect(linesInGap(g, W, H, res, 1, 0.5, 1, 0, 0.9, 0.23)).toBe(false);
  });
});

describe('findRooms', () => {
  it('finds two rectangular rooms on the wall centre lines', () => {
    const walls = [
      { x1: 0, y1: 0, x2: 6, y2: 0 },
      { x1: 6, y1: 0, x2: 6, y2: 4 },
      { x1: 6, y1: 4, x2: 0, y2: 4 },
      { x1: 0, y1: 4, x2: 0, y2: 0 },
      { x1: 3.5, y1: 0, x2: 3.5, y2: 4 },
    ];
    const { rooms } = findRooms(walls, { thick: 0.23 });
    const sorted = rooms.sort((a, b) => a.x - b.x);
    expect(sorted).toEqual([
      { x: 0, y: 0, w: 3.5, h: 4 },
      { x: 3.5, y: 0, w: 2.5, h: 4 },
    ]);
  });

  it('ignores an unclosed outline', () => {
    const walls = [
      { x1: 0, y1: 0, x2: 6, y2: 0 },
      { x1: 6, y1: 0, x2: 6, y2: 4 },
      { x1: 0, y1: 4, x2: 0, y2: 0 },
    ];
    expect(findRooms(walls, { thick: 0.23 }).rooms).toEqual([]);
  });

  it('skips an L-shaped space', () => {
    const walls = [
      { x1: 0, y1: 0, x2: 6, y2: 0 },
      { x1: 6, y1: 0, x2: 6, y2: 2 },
      { x1: 6, y1: 2, x2: 3, y2: 2 },
      { x1: 3, y1: 2, x2: 3, y2: 5 },
      { x1: 3, y1: 5, x2: 0, y2: 5 },
      { x1: 0, y1: 5, x2: 0, y2: 0 },
    ];
    expect(findRooms(walls, { thick: 0.23 })).toMatchObject({ rooms: [], skipped: 1 });
  });
});

describe('vectorize', () => {
  // A 7 × 4 m house: two rooms split at x = 4, a 0.9 m door in the top wall of the left room
  // and a 1.5 m window in the bottom wall of the right room.
  function house(T = 0.23) {
    const c = canvas(7, 4);
    wall(c, 0, 0, 1.55, 0, T);
    wall(c, 2.45, 0, 7, 0, T);
    wall(c, 7, 0, 7, 4, T);
    wall(c, 7, 4, 6.25, 4, T);
    wall(c, 4.75, 4, 0, 4, T);
    wall(c, 0, 4, 0, 0, T);
    wall(c, 4, 0, 4, 4, T);
    return c;
  }

  it('finds the walls on their centre lines', () => {
    const c = house();
    const r = vectorize(c.m, c.W, c.H, RES);
    const walls = r.walls.map(shift);
    expect(hasWall(walls, 0, 0, 7, 0)).toBe(true);
    expect(hasWall(walls, 7, 0, 7, 4)).toBe(true);
    expect(hasWall(walls, 0, 4, 7, 4)).toBe(true);
    expect(hasWall(walls, 0, 0, 0, 4)).toBe(true);
    expect(hasWall(walls, 4, 0, 4, 4)).toBe(true);
    expect(walls).toHaveLength(5);
  });

  it('measures the wall thickness', () => {
    const c = house(0.23);
    expect(vectorize(c.m, c.W, c.H, RES).wallT).toBeCloseTo(0.23, 1);
  });

  it('turns gaps into a door and a window', () => {
    const c = house();
    const r = vectorize(c.m, c.W, c.H, RES);
    const kinds = r.openings.map((o) => ({ type: o.type, w: Math.round(o.w * 10) / 10 })).sort((a, b) => a.w - b.w);
    expect(kinds).toEqual([
      { type: 'door', w: 0.9 },
      { type: 'window', w: 1.5 },
    ]);
  });

  it('finds the two rooms', () => {
    const c = house();
    const rooms = vectorize(c.m, c.W, c.H, RES)
      .rooms.map((q) => ({ x: q.x - 1, y: q.y - 1, w: q.w, h: q.h }))
      .sort((a, b) => a.x - b.x);
    expect(rooms).toHaveLength(2);
    for (const [q, want] of [
      [rooms[0], { x: 0, y: 0, w: 4, h: 4 }],
      [rooms[1], { x: 4, y: 0, w: 3, h: 4 }],
    ]) {
      for (const k of ['x', 'y', 'w', 'h']) expect(near(q[k], want[k], 0.08)).toBe(true);
    }
  });

  it('shares exact corner points so walls stay joined', () => {
    const c = house();
    const { walls } = vectorize(c.m, c.W, c.H, RES);
    // Compared at millimetre precision, as the plan store rounds coordinates.
    const mm = (v) => v.toFixed(3);
    const ends = walls.flatMap((w) => [`${mm(w.x1)},${mm(w.y1)}`, `${mm(w.x2)},${mm(w.y2)}`]);
    const counts = ends.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map());
    // 4 outer corners shared by two walls each, plus 2 T-junction ends on the outer walls.
    expect([...counts.values()].filter((n) => n >= 2)).toHaveLength(4);
  });

  it('keeps a wide gap between two rooms as a door and makes a wide gap in an outside wall a window', () => {
    const c = canvas(8, 4);
    // Outside walls with a 1.6 m gap in the top wall; a partition at x = 4 with a 1.6 m gap.
    wall(c, 0, 0, 2, 0);
    wall(c, 3.6, 0, 8, 0);
    wall(c, 8, 0, 8, 4);
    wall(c, 8, 4, 0, 4);
    wall(c, 0, 4, 0, 0);
    wall(c, 4, 0, 4, 1.2);
    wall(c, 4, 2.8, 4, 4);
    const r = vectorize(c.m, c.W, c.H, RES);
    expect(r.openings.map((o) => o.type).sort()).toEqual(['door', 'window']);
    expect(r.rooms).toHaveLength(2);
  });

  it('ignores the frame around the sheet', () => {
    const c = canvas(6, 4);
    wall(c, 0, 0, 6, 0);
    wall(c, 6, 0, 6, 4);
    wall(c, 6, 4, 0, 4);
    wall(c, 0, 4, 0, 0);
    for (let y = 0; y < c.H; y++) for (let x = 0; x < 4; x++) c.m[y * c.W + x] = 1; // left edge of the sheet
    const r = vectorize(c.m, c.W, c.H, RES);
    expect(r.walls).toHaveLength(4);
    expect(r.rooms).toHaveLength(1);
  });

  it('returns nothing for an empty mask', () => {
    const c = canvas(3, 3);
    expect(vectorize(c.m, c.W, c.H, RES)).toMatchObject({ walls: [], openings: [], rooms: [] });
  });
});
