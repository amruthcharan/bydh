import { describe, expect, it } from 'vitest';
import { dilate, dropBlobs, erode, otsu, quickMask } from './mask.js';
import { vectorize } from './vectorize.js';

const RES = 0.025;

/** A white W × H greyscale page with helpers to draw in metres (1 m margin). */
function page(wM, hM) {
  const W = Math.ceil((wM + 2) / RES),
    H = Math.ceil((hM + 2) / RES),
    g = new Uint8Array(W * H).fill(255);
  const px = (v) => Math.round((v + 1) / RES);
  const rect = (x0, y0, x1, y1, v = 20) => {
    for (let y = px(y0); y < px(y1); y++) for (let x = px(x0); x < px(x1); x++) g[y * W + x] = v;
  };
  return { W, H, g, px, rect };
}
const count = (m) => m.reduce((a, v) => a + v, 0);

describe('morphology helpers', () => {
  it('otsu splits dark ink from white paper', () => {
    const g = new Uint8Array(100).fill(250);
    g.fill(10, 0, 30);
    const t = otsu(g);
    expect(t).toBeGreaterThanOrEqual(10);
    expect(t).toBeLessThan(250);
  });

  it('opening removes a one-pixel line and keeps a thick bar', () => {
    const W = 40,
      H = 40,
      m = new Uint8Array(W * H);
    for (let x = 0; x < W; x++) m[5 * W + x] = 1;
    for (let y = 20; y < 28; y++) for (let x = 5; x < 35; x++) m[y * W + x] = 1;
    const o = dilate(erode(m, W, H, 1), W, H, 1);
    expect(o[5 * W + 20]).toBe(0);
    expect(o[24 * W + 20]).toBe(1);
  });

  it('dropBlobs removes small or compact blobs', () => {
    const W = 50,
      H = 50,
      m = new Uint8Array(W * H);
    for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) m[y * W + x] = 1; // small square
    for (let y = 20; y < 24; y++) for (let x = 2; x < 48; x++) m[y * W + x] = 1; // long bar
    const out = dropBlobs(m, W, H, 30, 20);
    expect(count(out)).toBe(46 * 4);
  });
});

describe('quickMask', () => {
  it('keeps solid walls and drops text, door arcs and dimension lines', () => {
    const p = page(6, 4),
      T = 0.23;
    p.rect(-T / 2, -T / 2, 6 + T / 2, T / 2); // top
    p.rect(-T / 2, 4 - T / 2, 6 + T / 2, 4 + T / 2); // bottom
    p.rect(-T / 2, -T / 2, T / 2, 4 + T / 2); // left
    p.rect(6 - T / 2, -T / 2, 6 + T / 2, 4 + T / 2); // right
    // Clutter: a dimension line, "text" strokes and a door arc, all thin.
    p.rect(0, -0.6, 6, -0.575, 60);
    for (let i = 0; i < 8; i++) p.rect(2 + i * 0.12, 1.8, 2 + i * 0.12 + 0.03, 2.1, 30);
    for (let a = 0; a < Math.PI / 2; a += 0.01) {
      const x = p.px(1 + Math.cos(a) * 0.9),
        y = p.px(0.1 + Math.sin(a) * 0.9);
      p.g[y * p.W + x] = 0;
    }
    const m = quickMask(p.g, p.W, p.H, RES);
    const r = vectorize(m, p.W, p.H, RES);
    expect(r.walls).toHaveLength(4);
    expect(r.rooms).toHaveLength(1);
    expect(r.rooms[0].w).toBeCloseTo(6, 1);
  });

  it('fills hollow walls drawn as two lines when asked', () => {
    const p = page(5, 4),
      T = 0.23,
      L = 0.03;
    const hollow = (x0, y0, x1, y1) => {
      if (y0 === y1) {
        p.rect(x0 - T / 2, y0 - T / 2, x1 + T / 2, y0 - T / 2 + L);
        p.rect(x0 - T / 2, y0 + T / 2 - L, x1 + T / 2, y0 + T / 2);
      } else {
        p.rect(x0 - T / 2, y0 - T / 2, x0 - T / 2 + L, y1 + T / 2);
        p.rect(x0 + T / 2 - L, y0 - T / 2, x0 + T / 2, y1 + T / 2);
      }
    };
    hollow(0, 0, 5, 0);
    hollow(0, 4, 5, 4);
    hollow(0, 0, 0, 4);
    hollow(5, 0, 5, 4);
    expect(vectorize(quickMask(p.g, p.W, p.H, RES), p.W, p.H, RES).walls).toHaveLength(0);
    const r = vectorize(quickMask(p.g, p.W, p.H, RES, { hollow: true }), p.W, p.H, RES);
    expect(r.walls).toHaveLength(4);
    expect(r.rooms).toHaveLength(1);
  });
});
