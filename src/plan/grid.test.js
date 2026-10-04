import { describe, expect, it } from 'vitest';
import { MIN_GRID_PX, gridFor } from './grid.js';

const IN = 0.0254;

describe('gridFor', () => {
  it('gets finer as you zoom in (metres)', () => {
    expect(gridFor(260, 'm')).toEqual({ minor: 0.05, major: 0.5, snap: 0.05 });
    expect(gridFor(40, 'm')).toEqual({ minor: 0.25, major: 1, snap: 0.25 });
    expect(gridFor(6, 'm')).toMatchObject({ minor: 5, major: 25 });
  });

  it('uses feet and inches in feet mode', () => {
    expect(gridFor(260, 'ft').minor).toBeCloseTo(3 * IN);
    expect(gridFor(40, 'ft').minor).toBeCloseTo(12 * IN);
    expect(gridFor(40, 'ft').major).toBeCloseTo(60 * IN);
  });

  it('never snaps coarser than 1 m or 1 ft', () => {
    expect(gridFor(6, 'm').snap).toBe(1);
    expect(gridFor(6, 'ft').snap).toBeCloseTo(12 * IN);
    expect(gridFor(260, 'ft').snap).toBeCloseTo(3 * IN);
  });

  it('keeps minor lines at least MIN_GRID_PX apart across the zoom range', () => {
    for (let s = 6; s <= 260; s += 1) {
      for (const u of ['m', 'ft']) {
        const g = gridFor(s, u);
        expect(g.minor * s).toBeGreaterThanOrEqual(MIN_GRID_PX);
        expect(g.major).toBeGreaterThan(g.minor);
      }
    }
  });
});
