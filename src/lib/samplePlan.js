import { makeId } from './geometry.js';
import { SKU } from '../catalog/items.js';

export const DEFAULT_SETTINGS = { wallH: 3.0, wallT: 0.23, north: 0, sun: 10, units: 'ft' };

export function blankPlan() {
  return { version: 2, name: 'Untitled home', walls: [], openings: [], rooms: [], furniture: [], underlay: null, settings: { ...DEFAULT_SETTINGS } };
}

/** Fill in anything an older or hand-edited plan file is missing. */
export function normalizePlan(obj) {
  const p = Object.assign(blankPlan(), obj || {});
  p.settings = Object.assign({ ...DEFAULT_SETTINGS }, p.settings || {});
  for (const k of ['walls', 'openings', 'rooms', 'furniture']) if (!Array.isArray(p[k])) p[k] = [];
  p.furniture = p.furniture.filter((f) => SKU[f.sku]);
  if (p.underlay && !p.underlay.src) p.underlay = null;
  return p;
}

/** A furnished 3-bedroom bungalow, 12 × 9 m, 9″ brick walls. */
export function samplePlan() {
  const s = blankPlan();
  s.name = 'Sample · 3-bed bungalow';
  const W = (x1, y1, x2, y2) => { const w = { id: makeId('w'), x1, y1, x2, y2 }; s.walls.push(w); return w; };
  const O = (w, t, type, wd, extra = {}) =>
    s.openings.push({ id: makeId('o'), wall: w.id, t, type, w: wd, h: type === 'door' ? 2.1 : 1.2, sill: 0.9, flip: false, ...extra });
  const R = (name, x, y, w, h, floor) => s.rooms.push({ id: makeId('r'), name, x, y, w, h, floor });
  const F = (sku, x, y, rot) => s.furniture.push({ id: makeId('f'), sku, x, y, rot, color: SKU[sku].colors[0] });

  const n = W(0, 0, 12, 0), e = W(12, 0, 12, 9), so = W(12, 9, 0, 9), we = W(0, 9, 0, 0);
  const iA = W(7, 0, 7, 5), iB = W(0, 5, 12, 5); W(4.5, 5, 4.5, 9); W(7, 5, 7, 9);

  R('Living & dining', 0, 0, 7, 5, 'vitrified');
  R('Kitchen', 7, 0, 5, 5, 'kota');
  R('Bedroom 1', 0, 5, 4.5, 4, 'wood');
  R('Bath', 4.5, 5, 2.5, 4, 'tile');
  R('Bedroom 2', 7, 5, 5, 4, 'marble');

  O(n, 0.25, 'door', 1.0, { flip: true }); O(n, 0.47, 'window', 1.5); O(n, 0.8, 'window', 1.2);
  O(e, 0.3, 'window', 1.2); O(e, 0.78, 'window', 1.5);
  O(so, 0.21, 'window', 1.5); O(so, 0.52, 'window', 0.6, { sill: 1.5, h: 0.6 }); O(so, 0.81, 'window', 1.5);
  O(we, 0.87, 'window', 1.5); O(we, 0.22, 'window', 1.2);
  O(iA, 0.5, 'door', 1.2); O(iB, 0.3, 'door', 0.9); O(iB, 0.483, 'door', 0.75); O(iB, 0.66, 'door', 0.9, { flip: true });

  // Living & dining
  F('LV-RUG', 1.85, 3.0, 90); F('LV-TV-18', 0.325, 3.0, 270); F('LV-SOFA-3', 3.2, 3.0, 90);
  F('LV-COFFEE', 1.85, 3.0, 90); F('LV-ARM', 1.5, 1.2, 0); F('DN-4', 5.4, 2.3, 0);
  F('DC-POOJA', 6.4, 4.635, 180); F('DC-PLANT-L', 6.55, 0.5, 0);
  // Kitchen: L-shaped modular run along the north and east walls
  F('KT-CORNER', 11.435, 0.565, 0); F('KT-HOB-90', 10.535, 0.415, 0); F('KT-SINK-90', 9.635, 0.415, 0);
  F('KT-BASE-60', 8.885, 0.415, 0); F('KT-TALL', 8.285, 0.415, 0); F('KT-CHIMNEY', 10.535, 0.365, 0);
  F('KT-WALL-60', 8.885, 0.29, 0); F('KT-BASE-90', 11.585, 1.465, 90); F('KT-BASE-90', 11.585, 2.365, 90);
  F('KT-FRIDGE-2', 11.535, 4.2, 90);
  // Bedroom 1
  F('BD-KING', 2.0, 7.845, 180); F('BD-NIGHT', 0.835, 8.685, 180); F('BD-NIGHT', 3.165, 8.685, 180);
  F('BD-WARD-3', 4.085, 6.6, 90);
  // Bath
  F('BT-TUB', 5.75, 8.51, 180); F('BT-WC', 6.545, 6.3, 90); F('BT-VANITY', 4.855, 6.4, 270);
  // Bedroom 2
  F('BD-QUEEN', 10.0, 7.845, 180); F('BD-NIGHT', 8.99, 8.685, 180); F('BD-NIGHT', 11.01, 8.685, 180);
  F('OF-DESK', 7.415, 6.9, 270); F('OF-CHAIR', 7.95, 6.9, 90); F('BD-WARD-SL', 10.4, 5.44, 0);
  return s;
}
