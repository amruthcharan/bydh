import { M_PER_IN } from '../lib/units.js';

const FT = 12 * M_PER_IN;

// Grid levels, finest first, in metres.
const LEVELS = {
  m: [
    { minor: 0.05, major: 0.5 },
    { minor: 0.1, major: 1 },
    { minor: 0.25, major: 1 },
    { minor: 0.5, major: 1 },
    { minor: 1, major: 5 },
    { minor: 5, major: 25 },
  ],
  ft: [
    { minor: 3 * M_PER_IN, major: FT },
    { minor: 6 * M_PER_IN, major: FT },
    { minor: FT, major: 5 * FT },
    { minor: 5 * FT, major: 25 * FT },
    { minor: 10 * FT, major: 50 * FT },
  ],
};

/** Minor lines are kept at least this many pixels apart. */
export const MIN_GRID_PX = 8;

/**
 * The grid for a zoom level `s` (pixels per metre), in the plan's units.
 * `snap` is the step corners snap to: the minor step, but never coarser than 1 m (or 1 ft).
 */
export function gridFor(s, units) {
  const ft = units === 'ft',
    levels = LEVELS[ft ? 'ft' : 'm'];
  const level = levels.find((l) => l.minor * s >= MIN_GRID_PX) || levels[levels.length - 1];
  return { ...level, snap: Math.min(level.minor, ft ? FT : 1) };
}
