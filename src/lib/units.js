export const SQFT_PER_M2 = 10.7639;

export const M_PER_IN = 0.0254;

export function ftin(m) {
  const ti = Math.round(Math.abs(m) / M_PER_IN), sign = m < 0 && ti ? '−' : '';
  return `${sign}${Math.floor(ti / 12)}′${ti % 12}″`;
}
export const fmtLen = (m, units) => (units === 'ft' ? ftin(m) : `${m.toFixed(2)} m`);
/** Item size as width × depth × height: feet and inches, or centimetres. */
export const fmtSize = (i, units) =>
  units === 'ft' ? `${ftin(i.w)} × ${ftin(i.d)} × ${ftin(i.h)}` : `${Math.round(i.w * 100)} × ${Math.round(i.d * 100)} × ${Math.round(i.h * 100)} cm`;
/** The text to put in a length field. */
export const lenInput = (m, units) => (units === 'ft' ? ftin(m) : String(Math.round(m * 100) / 100));

const NUM = String.raw`(\d*\.?\d+)`;
const FT = String.raw`('|′|ft|feet|foot)`;
const IN = String.raw`(?:"|″|''|in|inch|inches)`;
const METRIC = new RegExp(String.raw`^${NUM}\s*(mm|cm|m)$`);
const INCHES = new RegExp(String.raw`^${NUM}\s*${IN}$`);
const IMPERIAL = new RegExp(String.raw`^${NUM}\s*${FT}?\s*(?:${NUM}\s*${IN}?)?$`);

/**
 * Read a typed length and return metres, or NaN if it can't be read.
 * Accepts 12'6", 12′6″, 12 ft 6 in, 12 6, 150", 3.8m and 380cm.
 * A bare number is in the plan's units: feet for 'ft', metres otherwise.
 */
export function parseLen(text, units) {
  const s = String(text ?? '').trim().toLowerCase();
  let m;
  if ((m = s.match(METRIC))) return +m[1] * { mm: 0.001, cm: 0.01, m: 1 }[m[2]];
  if ((m = s.match(INCHES))) return +m[1] * M_PER_IN;
  if ((m = s.match(IMPERIAL))) {
    if (m[3] !== undefined) return (+m[1] * 12 + +m[3]) * M_PER_IN;
    if (m[2] || units === 'ft') return +m[1] * 12 * M_PER_IN;
    return +m[1];
  }
  return NaN;
}
export const fmtArea = (a, units) =>
  units === 'ft' ? `${Math.round(a * SQFT_PER_M2).toLocaleString('en-IN')} sq ft` : `${a.toFixed(1)} m²`;
export const fmtINR = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
export function fmtHour(h) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
