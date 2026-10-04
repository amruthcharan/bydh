// Turn a wall mask into walls, openings and rooms.
// Pure functions with no DOM, so they run in a worker and in tests.
// Input coordinates are pixels of the working image, with `res` metres per pixel.
// Output coordinates are "image metres": x = px * res, y = py * res (y down).

import { distToSeg } from '../lib/geometry.js';

/* ---------- raster steps ---------- */

/** Zhang–Suen thinning. Returns a new mask, one pixel wide along each wall's centre line. */
export function thin(mask, W, H) {
  const img = mask.slice();
  for (let x = 0; x < W; x++) img[x] = img[(H - 1) * W + x] = 0;
  for (let y = 0; y < H; y++) img[y * W] = img[y * W + W - 1] = 0;
  const del = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      del.length = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          if (!img[i]) continue;
          const p2 = img[i - W],
            p3 = img[i - W + 1],
            p4 = img[i + 1],
            p5 = img[i + W + 1];
          const p6 = img[i + W],
            p7 = img[i + W - 1],
            p8 = img[i - 1],
            p9 = img[i - W - 1];
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
          if (A !== 1) continue;
          if (step === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
          del.push(i);
        }
      }
      for (const i of del) img[i] = 0;
      if (del.length) changed = true;
    }
  }
  return img;
}

/** Chamfer (3-4) distance from each mask pixel to the nearest background pixel, in pixels. */
export function distanceMap(mask, W, H) {
  const BIG = 1e9,
    d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = mask[i] ? BIG : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[y * W + x]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  }
  for (let i = 0; i < W * H; i++) d[i] /= 3;
  return d;
}

/** Median wall thickness in pixels, read from the distance map along the skeleton. */
export function wallThickness(skel, dist) {
  const v = [];
  for (let i = 0; i < skel.length; i++) if (skel[i]) v.push(dist[i]);
  if (!v.length) return 0;
  v.sort((a, b) => a - b);
  return Math.max(1, 2 * v[v.length >> 1] - 1);
}

const N8 = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/** Follow the skeleton into pixel paths that run between junctions and ends. */
export function trace(skel, W, H) {
  const nb = (i) => {
    const x = i % W,
      y = (i / W) | 0,
      out = [];
    for (const [dx, dy] of N8) {
      const nx = x + dx,
        ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && skel[ny * W + nx]) out.push(ny * W + nx);
    }
    return out;
  };
  const isNode = new Uint8Array(W * H),
    seen = new Uint8Array(W * H),
    paths = [];
  for (let i = 0; i < W * H; i++) if (skel[i] && nb(i).length !== 2) isNode[i] = 1;
  const walk = (start, first) => {
    const path = [start, first];
    let prev = start,
      cur = first;
    while (!isNode[cur]) {
      seen[cur] = 1;
      const next = nb(cur).find((n) => n !== prev && !(seen[n] && !isNode[n]));
      if (next === undefined) break;
      path.push(next);
      prev = cur;
      cur = next;
      if (cur === start) break;
    }
    return path;
  };
  for (let i = 0; i < W * H; i++) {
    if (!isNode[i]) continue;
    for (const n of nb(i)) {
      if (isNode[n]) {
        if (i < n) paths.push([i, n]);
        continue;
      }
      if (!seen[n]) paths.push(walk(i, n));
    }
  }
  // Closed loops with no junction.
  for (let i = 0; i < W * H; i++) {
    if (skel[i] && !seen[i] && !isNode[i]) {
      seen[i] = 1;
      const n = nb(i)[0];
      if (n !== undefined) paths.push(walk(i, n));
    }
  }
  return paths.map((p) => p.map((i) => [i % W, (i / W) | 0]));
}

/** Douglas–Peucker line simplification. */
export function simplify(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1,
      bd = eps;
    for (let i = a + 1; i < b; i++) {
      const d = distToSeg(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]).d;
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/* ---------- vector clean-up ---------- */

const len = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);

/** Make nearly horizontal or vertical segments exactly so. */
export function snapAxes(segs, maxDeg) {
  const lim = Math.tan((maxDeg * Math.PI) / 180);
  for (const s of segs) {
    const dx = Math.abs(s.x2 - s.x1),
      dy = Math.abs(s.y2 - s.y1);
    if (dy <= dx * lim) {
      const y = (s.y1 + s.y2) / 2;
      s.y1 = s.y2 = y;
    } else if (dx <= dy * lim) {
      const x = (s.x1 + s.x2) / 2;
      s.x1 = s.x2 = x;
    }
  }
  return segs;
}

/**
 * Join collinear horizontal and vertical pieces. Small gaps close up. Gaps the size of a
 * door or window become one wall with an opening, recorded by its centre and width.
 */
export function mergeCollinear(segs, o) {
  const out = [],
    groups = { h: [], v: [] };
  for (const s of segs) {
    if (s.y1 === s.y2 && s.x1 !== s.x2) groups.h.push({ c: s.y1, a: Math.min(s.x1, s.x2), b: Math.max(s.x1, s.x2) });
    else if (s.x1 === s.x2 && s.y1 !== s.y2) groups.v.push({ c: s.x1, a: Math.min(s.y1, s.y2), b: Math.max(s.y1, s.y2) });
    else out.push({ ...s, openings: [] });
  }
  for (const [axis, list] of Object.entries(groups)) {
    list.sort((p, q) => p.c - q.c);
    const lines = [];
    for (const s of list) {
      const line = lines.find((l) => Math.abs(l.c - s.c) <= o.lineTol);
      if (line) {
        line.items.push(s);
        line.wsum += s.b - s.a;
        line.csum += s.c * (s.b - s.a);
        line.c = line.csum / line.wsum;
      } else lines.push({ c: s.c, items: [s], wsum: s.b - s.a, csum: s.c * (s.b - s.a) });
    }
    for (const line of lines) {
      line.items.sort((p, q) => p.a - q.a);
      let cur = null;
      const flush = () => {
        if (!cur) return;
        const w = axis === 'h' ? { x1: cur.a, y1: line.c, x2: cur.b, y2: line.c } : { x1: line.c, y1: cur.a, x2: line.c, y2: cur.b };
        w.openings = cur.gaps.map(([g0, g1]) => (axis === 'h' ? { cx: (g0 + g1) / 2, cy: line.c, w: g1 - g0 } : { cx: line.c, cy: (g0 + g1) / 2, w: g1 - g0 }));
        out.push(w);
      };
      for (const s of line.items) {
        if (!cur) {
          cur = { a: s.a, b: s.b, gaps: [] };
          continue;
        }
        const gap = s.a - cur.b;
        if (gap <= o.mergeGap) cur.b = Math.max(cur.b, s.b);
        else if (gap >= o.openingMin && gap <= o.openingMax) {
          cur.gaps.push([cur.b, s.a]);
          cur.b = s.b;
        } else {
          flush();
          cur = { a: s.a, b: s.b, gaps: [] };
        }
      }
      flush();
    }
  }
  return out;
}

function lineIntersect(a, b) {
  const d1x = a.x2 - a.x1,
    d1y = a.y2 - a.y1,
    d2x = b.x2 - b.x1,
    d2y = b.y2 - b.y1;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9 * Math.hypot(d1x, d1y) * Math.hypot(d2x, d2y)) return null;
  const t = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / den;
  return [a.x1 + t * d1x, a.y1 + t * d1y];
}

/** Move each wall end that stops near another wall onto that wall's line, closing corners and T-junctions. */
export function joinEnds(walls, tol) {
  for (const a of walls) {
    for (const k of [1, 2]) {
      const ex = a['x' + k],
        ey = a['y' + k];
      let best = null;
      for (const b of walls) {
        if (b === a || distToSeg(ex, ey, b.x1, b.y1, b.x2, b.y2).d > tol) continue;
        const p = lineIntersect(a, b);
        if (!p) continue;
        const d = Math.hypot(p[0] - ex, p[1] - ey);
        if (d < tol * 1.5 && (!best || d < best.d)) best = { d, p };
      }
      if (best) {
        a['x' + k] = best.p[0];
        a['y' + k] = best.p[1];
      }
    }
  }
  // Ends that are now within a hair of each other become exactly equal,
  // as long as that keeps horizontal and vertical walls exactly so.
  const ends = walls.flatMap((w) => [
    [w, 1],
    [w, 2],
  ]);
  for (let i = 0; i < ends.length; i++) {
    const [w, k] = ends[i],
      x = w['x' + k],
      y = w['y' + k];
    for (let j = i + 1; j < ends.length; j++) {
      const [v, m] = ends[j];
      if (Math.hypot(x - v['x' + m], y - v['y' + m]) >= 0.03) continue;
      if (v.y1 === v.y2) {
        if (Math.abs(y - v.y1) < 1e-6) v['x' + m] = x;
      } else if (v.x1 === v.x2) {
        if (Math.abs(x - v.x1) < 1e-6) v['y' + m] = y;
      } else {
        v['x' + m] = x;
        v['y' + m] = y;
      }
    }
  }
  return walls;
}

/**
 * A horizontal or vertical wall whose end is free, and which points at another wall no more than
 * `maxGap` away, is extended to meet it. Gaps of `minGap` or more become an opening.
 */
export function extendEnds(walls, minGap, maxGap, minWall = 0.4) {
  const touches = (x, y, self) => walls.some((v) => v !== self && distToSeg(x, y, v.x1, v.y1, v.x2, v.y2).d < 0.02);
  for (const w of walls) {
    const horiz = w.y1 === w.y2,
      vert = w.x1 === w.x2;
    if ((!horiz && !vert) || len(w) < minWall) continue;
    for (const k of [1, 2]) {
      const ex = w['x' + k],
        ey = w['y' + k];
      if (touches(ex, ey, w)) continue;
      const o = k === 1 ? 2 : 1,
        dx = Math.sign(ex - w['x' + o]),
        dy = Math.sign(ey - w['y' + o]);
      let best = null;
      for (const v of walls) {
        if (v === w) continue;
        // Distance along the ray to where it crosses v (perpendicular walls only).
        let d = null;
        if (horiz && v.x1 === v.x2 && ey >= Math.min(v.y1, v.y2) - 0.02 && ey <= Math.max(v.y1, v.y2) + 0.02) d = (v.x1 - ex) * dx;
        if (vert && v.y1 === v.y2 && ex >= Math.min(v.x1, v.x2) - 0.02 && ex <= Math.max(v.x1, v.x2) + 0.02) d = (v.y1 - ey) * dy;
        if (d !== null && d > 0 && d <= maxGap && (!best || d < best)) best = d;
      }
      if (!best) continue;
      const nx = ex + dx * best,
        ny = ey + dy * best;
      if (best >= minGap) (w.openings ||= []).push({ cx: (ex + nx) / 2, cy: (ey + ny) / 2, w: best });
      w['x' + k] = nx;
      w['y' + k] = ny;
    }
  }
  return walls;
}

/** Drop very short pieces and short spurs that hang off a wall with a free end. */
export function dropStubs(walls, minLen) {
  const touches = (w, k) => walls.some((v) => v !== w && distToSeg(w['x' + k], w['y' + k], v.x1, v.y1, v.x2, v.y2).d < 0.02);
  return walls.filter((w) => {
    const L = len(w);
    if (L < 0.1) return false;
    return L >= minLen || (touches(w, 1) && touches(w, 2));
  });
}

/* ---------- rooms ---------- */

/**
 * Find rectangular rooms enclosed by walls. Rooms run between wall centre lines, as drawn rooms do.
 * The open floor is first shrunk by `close` metres from every wall, so doorways up to twice that
 * wide pinch shut and each room leaves a separate core; a core grown back by `close` gives the room.
 * Spaces that aren't close to rectangular are skipped and counted in `skipped`.
 */
export function findRooms(walls, { cell = 0.05, thick = 0.15, close = 0.55, minArea = 1.5, minFill = 0.8 } = {}) {
  if (!walls.length) return { rooms: [], skipped: 0, outside: () => true };
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const w of walls) {
    x0 = Math.min(x0, w.x1, w.x2);
    y0 = Math.min(y0, w.y1, w.y2);
    x1 = Math.max(x1, w.x1, w.x2);
    y1 = Math.max(y1, w.y1, w.y2);
  }
  const pad = 3 * cell + thick + close;
  x0 -= pad;
  y0 -= pad;
  x1 += pad;
  y1 += pad;
  const GW = Math.ceil((x1 - x0) / cell),
    GH = Math.ceil((y1 - y0) / cell),
    g = new Int32Array(GW * GH);
  const r = thick / 2 + cell * 0.5;
  for (const w of walls) {
    const i0 = Math.max(0, Math.floor((Math.min(w.x1, w.x2) - r - x0) / cell)),
      i1 = Math.min(GW - 1, Math.ceil((Math.max(w.x1, w.x2) + r - x0) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(w.y1, w.y2) - r - y0) / cell)),
      j1 = Math.min(GH - 1, Math.ceil((Math.max(w.y1, w.y2) + r - y0) / cell));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (distToSeg(x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell, w.x1, w.y1, w.x2, w.y2).d <= r) g[j * GW + i] = -1;
      }
    }
  }
  const free = new Uint8Array(GW * GH);
  for (let c = 0; c < GW * GH; c++) free[c] = g[c] === 0 ? 1 : 0;
  // The outside: open cells reachable from the grid's edge (walls span their openings, so it stays out).
  const ext = new Uint8Array(GW * GH),
    st = [];
  for (let c = 0; c < GW * GH; c++) {
    const i = c % GW,
      j = (c / GW) | 0;
    if (free[c] && (i === 0 || j === 0 || i === GW - 1 || j === GH - 1)) {
      ext[c] = 1;
      st.push(c);
    }
  }
  while (st.length) {
    const c = st.pop(),
      i = c % GW,
      j = (c / GW) | 0;
    for (const n of [i > 0 && c - 1, i < GW - 1 && c + 1, j > 0 && c - GW, j < GH - 1 && c + GW]) {
      if (n !== false && free[n] && !ext[n]) {
        ext[n] = 1;
        st.push(n);
      }
    }
  }
  const outside = (x, y) => {
    const i = Math.floor((x - x0) / cell),
      j = Math.floor((y - y0) / cell);
    return i < 0 || j < 0 || i >= GW || j >= GH || ext[j * GW + i] === 1;
  };
  // Keep only the cores: open cells more than `close` from any wall.
  const dist = distanceMap(free, GW, GH);
  for (let c = 0; c < GW * GH; c++) if (g[c] === 0 && dist[c] * cell <= close) g[c] = -2;
  // Label cores (4-connected). Cores touching the border are the outside.
  // Shrinking also eats in from the grid's edge, so 'touching the border' means coming within reach of it.
  const edge = Math.ceil(close / cell) + 1;
  let label = 1;
  const regions = [];
  const fill = (s, lab) => {
    const st = [s],
      reg = { n: 0, i0: GW, i1: 0, j0: GH, j1: 0, border: false };
    g[s] = lab;
    while (st.length) {
      const c = st.pop(),
        i = c % GW,
        j = (c / GW) | 0;
      reg.n++;
      reg.i0 = Math.min(reg.i0, i);
      reg.i1 = Math.max(reg.i1, i);
      reg.j0 = Math.min(reg.j0, j);
      reg.j1 = Math.max(reg.j1, j);
      if (i <= edge || j <= edge || i >= GW - 1 - edge || j >= GH - 1 - edge) reg.border = true;
      for (const n of [i > 0 && c - 1, i < GW - 1 && c + 1, j > 0 && c - GW, j < GH - 1 && c + GW]) {
        if (n !== false && g[n] === 0) {
          g[n] = lab;
          st.push(n);
        }
      }
    }
    return reg;
  };
  for (let c = 0; c < GW * GH; c++) if (g[c] === 0) regions.push(fill(c, ++label));

  // Snap a room edge to the nearest parallel wall centre line.
  const hLines = walls.filter((w) => w.y1 === w.y2).map((w) => w.y1),
    vLines = walls.filter((w) => w.x1 === w.x2).map((w) => w.x1);
  const snap = (v, lines) => {
    let best = v,
      bd = thick / 2 + cell * 3;
    for (const l of lines) {
      const d = Math.abs(l - v);
      if (d < bd) {
        bd = d;
        best = l;
      }
    }
    return best;
  };
  const rooms = [];
  let skipped = 0;
  for (const reg of regions) {
    if (reg.border) continue;
    if (reg.n < 4) continue;
    if (reg.n / ((reg.i1 - reg.i0 + 1) * (reg.j1 - reg.j0 + 1)) < minFill) {
      skipped++;
      continue;
    }
    const grow = close + thick / 2;
    const rx0 = snap(x0 + reg.i0 * cell - grow, vLines),
      rx1 = snap(x0 + (reg.i1 + 1) * cell + grow, vLines);
    const ry0 = snap(y0 + reg.j0 * cell - grow, hLines),
      ry1 = snap(y0 + (reg.j1 + 1) * cell + grow, hLines);
    if ((rx1 - rx0) * (ry1 - ry0) < minArea) continue;
    rooms.push({ x: rx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0 });
  }
  return { rooms, skipped, outside };
}

/* ---------- doors or windows ---------- */

/**
 * Does the drawing have lines inside an opening? Windows are drawn as thin lines across the gap;
 * door gaps are left empty (the swing arc sits beside the wall). Looks at the middle 70% of the gap,
 * within the wall's thickness. Coordinates are image metres.
 */
export function linesInGap(gray, W, H, res, cx, cy, ux, uy, width, thick) {
  let dark = 0,
    n = 0;
  const along = width * 0.35,
    across = thick * 0.45,
    step = res;
  for (let a = -along; a <= along; a += step) {
    for (let b = -across; b <= across; b += step) {
      const x = Math.round((cx + ux * a - uy * b) / res),
        y = Math.round((cy + uy * a + ux * b) / res);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      n++;
      if (gray[y * W + x] < 140) dark++;
    }
  }
  return n > 0 && dark / n > 0.06;
}

/* ---------- whole pipeline ---------- */

export const DEFAULTS = {
  axisDeg: 4, // segments within this angle of horizontal/vertical are straightened
  lineTol: 0.12, // collinear pieces this far apart (m) share one line (at least ¾ of the wall thickness)
  mergeGap: 0.15, // gaps up to this (m) close up
  openingMin: 0.5, // gaps between these widths (m) become openings
  openingMax: 3.5,
  doorMax: 1.25, // openings up to this width are doors, wider ones windows
  minLen: 0.3, // free-ended pieces shorter than this (m) are dropped
};

/**
 * Mask (1 = wall) → { walls, openings, rooms, wallT, skippedRooms } in image metres.
 * Openings reference walls by index: { wall, t, w, type }.
 * Pass the greyscale drawing as `opts.gray` to tell doors from windows by what's drawn in the gap;
 * without it, openings are told apart by width and position.
 */
export function vectorize(mask, W, H, res, opts = {}) {
  const skel = thin(mask, W, H);
  const wallT = wallThickness(skel, distanceMap(mask, W, H)) * res;
  const { gray, ...rest } = opts;
  const o = { ...DEFAULTS, ...rest };
  o.lineTol = Math.max(o.lineTol, wallT * 0.75);
  const joinTol = Math.max(0.2, wallT * 1.2);
  const segs = [];
  for (const p of trace(skel, W, H)) {
    const pts = simplify(p, Math.max(1.5, 0.05 / res));
    for (let i = 1; i < pts.length; i++) {
      segs.push({ x1: pts[i - 1][0] * res, y1: pts[i - 1][1] * res, x2: pts[i][0] * res, y2: pts[i][1] * res });
    }
  }
  // Thinning leaves pixel-sized stubs where walls meet; they aren't walls.
  const minSeg = Math.max(0.08, wallT * 0.5);
  let walls = mergeCollinear(
    snapAxes(
      segs.filter((s) => len(s) >= minSeg),
      o.axisDeg,
    ),
    o,
  );
  // Lines along the edge of the sheet are its frame, not walls.
  const edge = Math.max(0.15, 0.015 * Math.max(W, H) * res),
    Wm = W * res,
    Hm = H * res;
  const onEdge = (v, max) => v < edge || v > max - edge;
  walls = walls.filter((w) => !((w.x1 === w.x2 && onEdge(w.x1, Wm)) || (w.y1 === w.y2 && onEdge(w.y1, Hm))));
  walls = joinEnds(walls, joinTol);
  walls = dropStubs(walls, o.minLen);
  // A second pass joins pieces that only lined up after the ends moved.
  walls = joinEnds(
    mergeCollinear(
      walls.flatMap((w) => splitAtOpenings(w)),
      o,
    ),
    joinTol,
  );
  walls = extendEnds(walls, o.openingMin, o.doorMax);

  const thick = Math.max(0.1, wallT);
  const { rooms, skipped, outside } = findRooms(walls, { thick });

  // Openings with the house on both sides are doors. A wider one stays a (sliding) door between two
  // rooms, but is left open when it leads to a hall or passage that isn't a room.
  // In outside walls, an opening with lines drawn across it is a window (or, without the drawing, a wide one is).
  const inRoom = (x, y) => rooms.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  const out = [],
    openings = [];
  for (const w of walls) {
    const L = len(w),
      ux = (w.x2 - w.x1) / L,
      uy = (w.y2 - w.y1) / L,
      off = thick / 2 + 0.15;
    const keep = [],
      passages = [];
    for (const op of w.openings || []) {
      const c = (op.cx - w.x1) * ux + (op.cy - w.y1) * uy;
      if (c - op.w / 2 < -0.01 || c + op.w / 2 > L + 0.01) continue;
      const ax = op.cx - uy * off,
        ay = op.cy + ux * off,
        bx = op.cx + uy * off,
        by = op.cy - ux * off;
      const inside = !outside(ax, ay) && !outside(bx, by);
      if (inside && op.w > o.doorMax && !(inRoom(ax, ay) && inRoom(bx, by))) passages.push(op);
      else {
        const win = !inside && (gray ? linesInGap(gray, W, H, res, op.cx, op.cy, ux, uy, op.w, thick) : op.w > o.doorMax);
        keep.push({ ...op, type: win ? 'window' : 'door' });
      }
    }
    for (const piece of splitAtOpenings({ ...w, openings: passages })) {
      const pl = len(piece);
      if (pl < 0.05) continue;
      const i = out.push(piece) - 1;
      for (const op of keep) {
        const c = (op.cx - piece.x1) * ux + (op.cy - piece.y1) * uy;
        if (c - op.w / 2 >= -0.01 && c + op.w / 2 <= pl + 0.01) openings.push({ wall: i, t: c / pl, w: op.w, type: op.type });
      }
    }
  }
  return { walls: out.map(({ x1, y1, x2, y2 }) => ({ x1, y1, x2, y2 })), openings, rooms, wallT, skippedRooms: skipped };
}

/** Undo an earlier merge so the second merge pass can rebuild openings from scratch. */
function splitAtOpenings(w) {
  if (!w.openings?.length) return [w];
  const L = len(w),
    ux = (w.x2 - w.x1) / L,
    uy = (w.y2 - w.y1) / L;
  const cuts = w.openings
    .map((op) => (op.cx - w.x1) * ux + (op.cy - w.y1) * uy)
    .map((c, i) => [c - w.openings[i].w / 2, c + w.openings[i].w / 2])
    .sort((a, b) => a[0] - b[0]);
  const out = [];
  let a = 0;
  for (const [c0, c1] of cuts) {
    out.push({ x1: w.x1 + ux * a, y1: w.y1 + uy * a, x2: w.x1 + ux * c0, y2: w.y1 + uy * c0 });
    a = c1;
  }
  out.push({ x1: w.x1 + ux * a, y1: w.y1 + uy * a, x2: w.x2, y2: w.y2 });
  return out;
}
