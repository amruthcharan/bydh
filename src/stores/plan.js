import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { get, set } from 'idb-keyval';
import { blankPlan, normalizePlan, samplePlan } from '../lib/samplePlan.js';
import { SKU } from '../catalog/items.js';
import { bbox, clamp, connectedEnds, distToSeg, makeId, r2, snapTo, wallLen } from '../lib/geometry.js';
import { wallSnap } from '../lib/snapping.js';

const KEY = 'bydh-plan-v2';

export const usePlanStore = defineStore('plan', () => {
  const plan = ref(blankPlan());
  const sel = ref(null);           // { kind: 'wall'|'opening'|'room'|'furniture'|'underlay', id }
  const rev = ref(0);              // bumps on every edit; the 3D view rebuilds from it
  const canUndo = ref(false);
  const canRedo = ref(false);
  let hist = [], hi = -1, saveTimer;

  /* ---------- history & persistence ---------- */
  const touch = () => { rev.value++; };
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { set(KEY, JSON.stringify(plan.value)).catch(() => {}); }, 300);
  }
  function syncFlags() { canUndo.value = hi > 0; canRedo.value = hi < hist.length - 1; }
  function commit() {
    const j = JSON.stringify(plan.value);
    if (hist[hi] === j) return;
    hist = hist.slice(0, hi + 1); hist.push(j);
    if (hist.length > 100) hist.shift();
    hi = hist.length - 1; syncFlags(); persist();
  }
  function restore(j) {
    plan.value = JSON.parse(j);
    if (sel.value && !find(sel.value)) sel.value = null;
    touch(); persist(); syncFlags();
  }
  const undo = () => { if (hi > 0) restore(hist[--hi]); };
  const redo = () => { if (hi < hist.length - 1) restore(hist[++hi]); };
  function load(obj) { plan.value = normalizePlan(obj); sel.value = null; touch(); commit(); }
  async function boot() {
    try {
      const saved = await get(KEY);
      if (saved) { load(JSON.parse(saved)); return 'restored'; }
    } catch { /* storage unavailable: fall through to the sample */ }
    load(samplePlan());
    return 'sample';
  }

  /* ---------- lookups ---------- */
  const wallById = (id) => plan.value.walls.find((w) => w.id === id);
  function find(s) {
    if (!s) return null;
    if (s.kind === 'underlay') return plan.value.underlay;
    const k = { wall: 'walls', opening: 'openings', room: 'rooms', furniture: 'furniture' }[s.kind];
    return k ? plan.value[k].find((o) => o.id === s.id) || null : null;
  }
  const selected = computed(() => { rev.value; return find(sel.value); });
  const select = (s) => { sel.value = s; };

  /* ---------- derived figures ---------- */
  const carpetArea = computed(() => plan.value.rooms.reduce((a, r) => a + r.w * r.h, 0));
  const footprint = computed(() => { const b = bbox(plan.value); return b.empty ? 0 : (b.x1 - b.x0) * (b.y1 - b.y0); });
  const shoppingList = computed(() => {
    const m = new Map();
    for (const f of plan.value.furniture) {
      const it = SKU[f.sku]; if (!it) continue;
      const row = m.get(f.sku) || { sku: f.sku, name: it.name, price: it.price, category: it.category, qty: 0 };
      row.qty++; m.set(f.sku, row);
    }
    return [...m.values()].map((r) => ({ ...r, total: r.qty * r.price })).sort((a, b) => b.total - a.total);
  });
  const furnitureTotal = computed(() => shoppingList.value.reduce((a, r) => a + r.total, 0));

  /* ---------- edits ---------- */
  function addWall(x1, y1, x2, y2) {
    const w = { id: makeId('w'), x1, y1, x2, y2 };
    plan.value.walls.push(w); touch(); return w;
  }
  function wallCovers(a, b, c, d) {
    return plan.value.walls.some((w) => distToSeg(a, b, w.x1, w.y1, w.x2, w.y2).d < 0.02 && distToSeg(c, d, w.x1, w.y1, w.x2, w.y2).d < 0.02);
  }
  function addRoom(x0, y0, x1, y1) {
    const r = { id: makeId('r'), name: `Room ${plan.value.rooms.length + 1}`, x: x0, y: y0, w: r2(x1 - x0), h: r2(y1 - y0), floor: 'vitrified' };
    plan.value.rooms.push(r);
    for (const [a, b, c, d] of [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]]) {
      if (!wallCovers(a, b, c, d)) plan.value.walls.push({ id: makeId('w'), x1: a, y1: b, x2: c, y2: d });
    }
    touch(); commit(); return r;
  }
  function nearestWall(x, y, maxD) {
    let best = null;
    for (const w of plan.value.walls) {
      const h = distToSeg(x, y, w.x1, w.y1, w.x2, w.y2);
      if (h.d < maxD && (!best || h.d < best.d)) best = { wall: w, d: h.d, t: h.t };
    }
    return best;
  }
  /** Returns the new opening, or an error string. */
  function addOpening(x, y, type) {
    const nw = nearestWall(x, y, 0.6);
    if (!nw) return `Click on a wall to place a ${type}.`;
    const w = nw.wall, L = wallLen(w), ow = Math.min(type === 'door' ? 0.9 : 1.2, L - 0.1);
    if (ow < 0.4) return `That wall is too short for a ${type}.`;
    const t = clamp(snapTo(nw.t * L, 0.05) / L, ow / 2 / L, 1 - ow / 2 / L);
    if (plan.value.openings.some((o) => o.wall === w.id && Math.abs(o.t * L - t * L) < (o.w + ow) / 2)) {
      return 'There is already an opening there. Pick a clear stretch of wall.';
    }
    const o = { id: makeId('o'), wall: w.id, t, type, w: ow, h: type === 'door' ? 2.1 : 1.2, sill: 0.9, flip: false };
    plan.value.openings.push(o); touch(); commit(); return o;
  }
  function addFurniture(sku, x, y, color) {
    const it = SKU[sku]; if (!it) return null;
    const f = { id: makeId('f'), sku, x: snapTo(x, 0.05), y: snapTo(y, 0.05), rot: 0, color: color || it.colors[0] };
    const s = wallSnap(plan.value, it, f.x, f.y);
    if (s) Object.assign(f, s);
    plan.value.furniture.push(f); touch(); commit(); return f;
  }
  function deleteObj(s) {
    const p = plan.value;
    if (s.kind === 'wall') { p.walls = p.walls.filter((w) => w.id !== s.id); p.openings = p.openings.filter((o) => o.wall !== s.id); }
    else if (s.kind === 'opening') p.openings = p.openings.filter((o) => o.id !== s.id);
    else if (s.kind === 'room') p.rooms = p.rooms.filter((o) => o.id !== s.id);
    else if (s.kind === 'furniture') p.furniture = p.furniture.filter((o) => o.id !== s.id);
    else if (s.kind === 'underlay') p.underlay = null;
    if (sel.value && sel.value.id === s.id && sel.value.kind === s.kind) sel.value = null;
    touch(); commit();
  }
  function rotateFurniture(f, by) { f.rot = ((f.rot + by) % 360 + 360) % 360; touch(); commit(); }
  function duplicateFurniture(f) {
    const n = { ...f, id: makeId('f'), x: f.x + 0.4, y: f.y + 0.4 };
    plan.value.furniture.push(n); touch(); commit(); sel.value = { kind: 'furniture', id: n.id };
  }
  function setWallLength(w, nl) {
    const L = wallLen(w); nl = clamp(nl, 0.25, 60); if (!(L > 0)) return;
    const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
    const links = connectedEnds(plan.value.walls, w.x2, w.y2, w);
    w.x2 = r2(w.x1 + ux * nl); w.y2 = r2(w.y1 + uy * nl);
    links.forEach(([o, e]) => { o['x' + e] = w.x2; o['y' + e] = w.y2; });
    plan.value.openings.filter((o) => o.wall === w.id).forEach((o) => { o.t = clamp((o.t * L) / nl, o.w / 2 / nl, 1 - o.w / 2 / nl); });
    touch();
  }
  function splitWall(w) {
    const mx = r2((w.x1 + w.x2) / 2), my = r2((w.y1 + w.y2) / 2), L = wallLen(w);
    const n = { id: makeId('w'), x1: mx, y1: my, x2: w.x2, y2: w.y2 };
    plan.value.openings.filter((o) => o.wall === w.id).forEach((o) => {
      const c = o.t * L;
      if (c > L / 2) { o.wall = n.id; o.t = (c - L / 2) / (L / 2); } else o.t = c / (L / 2);
    });
    w.x2 = mx; w.y2 = my; plan.value.walls.push(n); touch(); commit();
  }

  /* ---------- tracing image ---------- */
  function setUnderlay({ src, w, h }) {
    const b = bbox(plan.value);
    const widthM = b.empty ? 14 : Math.max(b.x1 - b.x0, 8) * 1.2;
    const mpp = widthM / w;
    plan.value.underlay = {
      src, w, h, mpp,
      x: b.empty ? widthM / 2 : (b.x0 + b.x1) / 2,
      y: b.empty ? (h * mpp) / 2 : (b.y0 + b.y1) / 2,
      rot: 0, opacity: 0.55, visible: true, locked: false, show3D: false,
    };
    sel.value = { kind: 'underlay', id: 'underlay' };
    touch(); commit();
  }
  /** Scale the image about p1 so the p1→p2 distance equals `real` metres. */
  function calibrate(p1, p2, real) {
    const u = plan.value.underlay; const measured = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (!u || !(measured > 0) || !(real > 0)) return false;
    const k = real / measured;
    u.mpp *= k; u.x = p1.x + (u.x - p1.x) * k; u.y = p1.y + (u.y - p1.y) * k;
    touch(); commit(); return true;
  }

  return {
    plan, sel, rev, canUndo, canRedo, selected,
    touch, commit, undo, redo, load, boot, find, select, wallById, nearestWall,
    carpetArea, footprint, shoppingList, furnitureTotal,
    addWall, addRoom, addOpening, addFurniture, deleteObj, rotateFurniture, duplicateFurniture,
    setWallLength, splitWall, setUnderlay, calibrate,
    newBlank: () => load(blankPlan()), loadSample: () => load(samplePlan()),
  };
});
