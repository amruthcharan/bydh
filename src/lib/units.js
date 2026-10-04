export const SQFT_PER_M2 = 10.7639;

export function ftin(m) {
  const ti = Math.round(m / 0.0254);
  return `${Math.floor(ti / 12)}′${ti % 12}″`;
}
export const fmtLen = (m, units) => (units === 'ft' ? ftin(m) : `${m.toFixed(2)} m`);
export const fmtArea = (a, units) =>
  units === 'ft' ? `${Math.round(a * SQFT_PER_M2).toLocaleString('en-IN')} sq ft` : `${a.toFixed(1)} m²`;
export const fmtINR = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
export function fmtHour(h) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
