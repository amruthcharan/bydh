import { describe, expect, it } from 'vitest';
import { fmtLen, fmtSize, ftin, lenInput, parseLen } from './units.js';

const ft = (f, i = 0) => (f * 12 + i) * 0.0254;

describe('ftin', () => {
  it('formats feet and whole inches', () => {
    expect(ftin(ft(12, 6))).toBe('12′6″');
    expect(ftin(3)).toBe('9′10″');
    expect(ftin(0)).toBe('0′0″');
  });

  it('carries 12 inches over to the next foot', () => {
    expect(ftin(ft(9, 11.8))).toBe('10′0″');
  });

  it('puts the sign in front of negative lengths', () => {
    expect(ftin(-ft(1, 5))).toBe('−1′5″');
    expect(ftin(-0.001)).toBe('0′0″');
  });
});

describe('fmtLen and fmtSize', () => {
  it('follows the units setting', () => {
    expect(fmtLen(3.81, 'ft')).toBe('12′6″');
    expect(fmtLen(3.81, 'm')).toBe('3.81 m');
  });

  it('formats an item size', () => {
    const bed = { w: 1.83, d: 2.08, h: 1.0 };
    expect(fmtSize(bed, 'ft')).toBe('6′0″ × 6′10″ × 3′3″');
    expect(fmtSize(bed, 'm')).toBe('183 × 208 × 100 cm');
  });
});

describe('parseLen', () => {
  it.each([
    [`12'6"`, ft(12, 6)],
    ['12′6″', ft(12, 6)],
    [`12' 6"`, ft(12, 6)],
    [`12'6''`, ft(12, 6)],
    ['12 ft 6 in', ft(12, 6)],
    ['12ft6in', ft(12, 6)],
    ['12 6', ft(12, 6)],
    [`12'`, ft(12)],
    ['12 feet', ft(12)],
    ['12.5', ft(12, 6)],
    [`150"`, ft(12, 6)],
    ['6 inches', ft(0, 6)],
    ['3.8m', 3.8],
    ['380 cm', 3.8],
    ['3800mm', 3.8],
    ['  12′6″  ', ft(12, 6)],
  ])('reads %s in feet mode', (text, metres) => {
    expect(parseLen(text, 'ft')).toBeCloseTo(metres, 6);
  });

  it('reads a bare number as metres in metre mode', () => {
    expect(parseLen('3.8', 'm')).toBeCloseTo(3.8);
    expect(parseLen(`12'6"`, 'm')).toBeCloseTo(ft(12, 6));
  });

  it.each(['', 'abc', '-3', '12′6″ 4', '3.8 km', '1/2'])('rejects %j', (text) => {
    expect(parseLen(text, 'ft')).toBeNaN();
  });

  it('reads back what lenInput writes', () => {
    for (const m of [0, 0.9, 2.1, 3.81, 12.2]) {
      expect(Math.abs(parseLen(lenInput(m, 'ft'), 'ft') - m)).toBeLessThanOrEqual(0.0127);
      expect(parseLen(lenInput(m, 'm'), 'm')).toBeCloseTo(m, 2);
    }
  });
});
