import { SKU } from '../catalog/items.js';
import { bbox, clamp, connectedEnds, distToSeg, inRotRect, snapTo, wallLen } from '../lib/geometry.js';
import { wallSnap } from '../lib/snapping.js';
import { walker } from '../lib/walker.js';
import { drawPlan, readTokens } from './drawPlan.js';
import { gridFor } from './grid.js';

/**
 * 2D floor-plan editor on a <canvas>. Owns the view transform and the
 * in-progress drawing state; all model changes go through the plan store.
 */
export class PlanEditor {
  constructor(canvas, store, ui, hooks = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.store = store; this.ui = ui; this.hooks = hooks;
    this.view = { s: 40, ox: 60, oy: 60 };
    this.dpr = 1; this.dirty = true;
    this.wallDraft = null; this.roomDraft = null; this.hover = null; this.drag = null;
    this.calibPts = []; this.pointers = new Map(); this.pinch = null; this.lastTap = 0; this.spaceDown = false;
    this._img = null; this._imgSrc = null;
    this.tk = readTokens();

    this._mq = window.matchMedia('(prefers-color-scheme: dark)');
    this._onTheme = () => { this.tk = readTokens(); this.dirty = true; };
    this._mq.addEventListener('change', this._onTheme);
    this._mo = new MutationObserver(this._onTheme);
    this._mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.fonts?.ready.then(this._onTheme);

    const on = (t, f, o) => canvas.addEventListener(t, f, o);
    on('pointerdown', (e) => this.onDown(e));
    on('pointermove', (e) => this.onMove(e));
    on('pointerup', (e) => this.onUp(e));
    on('pointercancel', (e) => this.onUp(e));
    on('pointerleave', () => { if (!this.drag && this.ui.tool !== 'wall') { this.hover = null; this.dirty = true; } });
    on('contextmenu', (e) => e.preventDefault());
    on('wheel', (e) => { e.preventDefault(); const [sx, sy] = this.evPos(e); this.zoomAt(Math.exp(-e.deltaY * 0.0015), sx, sy); }, { passive: false });
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas);
    this._raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this._raf); this._ro.disconnect(); this._mo.disconnect();
    this._mq.removeEventListener('change', this._onTheme);
  }

  loop = () => {
    if (this.dirty || walker.dirty) { this.dirty = false; walker.dirty = false; drawPlan(this); }
    this._raf = requestAnimationFrame(this.loop);
  };
  invalidate() { this.dirty = true; }

  /* ---------- view ---------- */
  resize() {
    this.dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return;
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    if (!this._fitted) { this._fitted = true; this.fit(); }
    this.dirty = true;
  }
  w2s(x, y) { return [x * this.view.s + this.view.ox, y * this.view.s + this.view.oy]; }
  s2w(x, y) { return [(x - this.view.ox) / this.view.s, (y - this.view.oy) / this.view.s]; }
  evPos(e) { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  clientToWorld(cx, cy) { const r = this.canvas.getBoundingClientRect(); return this.s2w(cx - r.left, cy - r.top); }
  zoomAt(f, sx, sy) {
    const [wx, wy] = this.s2w(sx, sy);
    this.view.s = clamp(this.view.s * f, 6, 260);
    this.view.ox = sx - wx * this.view.s; this.view.oy = sy - wy * this.view.s; this.dirty = true;
  }
  zoomBy(f) { this.zoomAt(f, this.canvas.clientWidth / 2, this.canvas.clientHeight / 2); }
  fit() {
    const p = this.store.plan; let b = bbox(p);
    const u = p.underlay;
    if (u && u.visible) {
      const hw = (u.w * u.mpp) / 2, hh = (u.h * u.mpp) / 2;
      b = b.empty ? { x0: u.x - hw, y0: u.y - hh, x1: u.x + hw, y1: u.y + hh } : { x0: Math.min(b.x0, u.x - hw), y0: Math.min(b.y0, u.y - hh), x1: Math.max(b.x1, u.x + hw), y1: Math.max(b.y1, u.y + hh) };
    }
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight - 30; if (!w || !h) return;
    const pad = 50, bw = Math.max(b.x1 - b.x0, 2), bh = Math.max(b.y1 - b.y0, 2);
    this.view.s = clamp(Math.min((w - pad * 2) / bw, (h - pad * 2) / bh), 6, 200);
    this.view.ox = (w - bw * this.view.s) / 2 - b.x0 * this.view.s;
    this.view.oy = (h - bh * this.view.s) / 2 - b.y0 * this.view.s;
    this.dirty = true;
  }
  underlayImg() {
    const u = this.store.plan.underlay; if (!u) return null;
    if (this._imgSrc !== u.src) {
      this._imgSrc = u.src; this._img = new Image();
      this._img.onload = () => { this.dirty = true; };
      this._img.src = u.src;
    }
    return this._img.complete && this._img.naturalWidth ? this._img : null;
  }

  /* ---------- hit testing ---------- */
  hitTest(x, y) {
    const p = this.store.plan, tol = Math.max(0.12, 8 / this.view.s), T = p.settings.wallT;
    if (walker.active && Math.hypot(x - walker.x, y - walker.z) < Math.max(0.35, 12 / this.view.s)) return { kind: 'walker' };
    // wall-mounted items sit "above" floor items
    const fs = p.furniture.slice().sort((a, b) => (SKU[b.sku]?.elev || 0) - (SKU[a.sku]?.elev || 0));
    for (let i = fs.length - 1; i >= 0; i--) {
      const f = fs[fs.length - 1 - i], it = SKU[f.sku];
      if (it && inRotRect(x, y, f.x, f.y, it.w, it.d, f.rot)) return { kind: 'furniture', id: f.id };
    }
    for (const o of p.openings) {
      const w = this.store.wallById(o.wall); if (!w) continue;
      const L = wallLen(w), h = distToSeg(x, y, w.x1, w.y1, w.x2, w.y2);
      if (h.d < T / 2 + tol + 0.1 && Math.abs(h.t * L - o.t * L) < o.w / 2) return { kind: 'opening', id: o.id };
    }
    for (const w of p.walls) {
      const h = distToSeg(x, y, w.x1, w.y1, w.x2, w.y2);
      if (h.d < T / 2 + tol) {
        const er = Math.max(0.3, 10 / this.view.s);
        if (Math.hypot(x - w.x1, y - w.y1) < er) return { kind: 'wall', id: w.id, end: 1 };
        if (Math.hypot(x - w.x2, y - w.y2) < er) return { kind: 'wall', id: w.id, end: 2 };
        return { kind: 'wall', id: w.id };
      }
    }
    for (let i = p.rooms.length - 1; i >= 0; i--) {
      const r = p.rooms[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { kind: 'room', id: r.id };
    }
    const u = p.underlay;
    if (u && u.visible && !u.locked && inRotRect(x, y, u.x, u.y, u.w * u.mpp, u.h * u.mpp, u.rot)) return { kind: 'underlay', id: 'underlay' };
    return null;
  }
  /** Snap step for corners, rooms and wall moves at this zoom (see gridFor). */
  gridStep() { return gridFor(this.view.s, this.store.plan.settings.units).snap; }
  snapPoint(x, y, from) {
    // Wall ends attract within 12 px on screen, so zooming in gives finer control.
    let best = null; const er = 12 / this.view.s, g = this.gridStep();
    for (const w of this.store.plan.walls) for (const q of [[w.x1, w.y1], [w.x2, w.y2]]) {
      const d = Math.hypot(x - q[0], y - q[1]); if (d < er && (!best || d < best.d)) best = { x: q[0], y: q[1], d };
    }
    if (best) return { x: best.x, y: best.y, snapped: true };
    let sx = snapTo(x, g), sy = snapTo(y, g);
    if (from) { const dx = sx - from.x, dy = sy - from.y; if (Math.abs(dy) < Math.abs(dx) * 0.14) sy = from.y; else if (Math.abs(dx) < Math.abs(dy) * 0.14) sx = from.x; }
    return { x: sx, y: sy, snapped: false };
  }
  placement(sku, x, y) {
    const it = SKU[sku]; if (!it) return null;
    const s = wallSnap(this.store.plan, it, x, y);
    return s ? { item: it, ...s } : { item: it, x: snapTo(x, 0.05), y: snapTo(y, 0.05), rot: 0 };
  }

  /* ---------- pointer handling ---------- */
  onDown(e) {
    this.hooks.onActivate?.();
    this.canvas.setPointerCapture(e.pointerId);
    const [sx, sy] = this.evPos(e); this.pointers.set(e.pointerId, { x: sx, y: sy });
    if (this.pointers.size === 2) {
      const q = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y), mx: (q[0].x + q[1].x) / 2, my: (q[0].y + q[1].y) / 2 };
      this.drag = null; this.roomDraft = null; return;
    }
    const [wx, wy] = this.s2w(sx, sy), tool = this.ui.tool, store = this.store;
    if (e.button === 1 || (e.button === 2 && tool !== 'wall') || this.spaceDown) { this.startPan(sx, sy); return; }
    if (e.button === 2 && tool === 'wall') { this.endWall(); return; }

    if (tool === 'select') {
      const h = this.hitTest(wx, wy);
      if (h && h.kind === 'walker') { this.drag = { type: 'walker' }; return; }
      if (h) { store.select({ kind: h.kind, id: h.id }); this.startObjDrag(h, wx, wy); }
      else { store.select(null); this.startPan(sx, sy); }
      this.dirty = true;
    } else if (tool === 'wall') {
      const now = performance.now(), q = this.snapPoint(wx, wy, this.wallDraft);
      if (this.wallDraft && (now - this.lastTap < 300 || Math.hypot(q.x - this.wallDraft.x, q.y - this.wallDraft.y) < 0.05)) { this.endWall(); return; }
      this.lastTap = now;
      if (this.wallDraft) {
        const w = store.addWall(this.wallDraft.x, this.wallDraft.y, q.x, q.y); store.commit();
        if (q.snapped && connectedEnds(store.plan.walls, q.x, q.y, w).length) { this.endWall(); return; }
      }
      this.wallDraft = { x: q.x, y: q.y }; this.hooks.onDraft?.(true); this.dirty = true;
    } else if (tool === 'room') {
      const q = this.snapPoint(wx, wy); this.roomDraft = { x0: q.x, y0: q.y, x1: q.x, y1: q.y };
    } else if (tool === 'door' || tool === 'window') {
      const r = store.addOpening(wx, wy, tool);
      if (typeof r === 'string') this.ui.toast(r); else store.select({ kind: 'opening', id: r.id });
    } else if (tool === 'place') {
      const sku = this.ui.placeSku, f = store.addFurniture(sku, wx, wy, this.ui.placeColor);
      if (f) {
        store.select({ kind: 'furniture', id: f.id });
        if (!e.shiftKey) { this.ui.setTool('select'); this.startObjDrag({ kind: 'furniture', id: f.id }, wx, wy); }
      }
    } else if (tool === 'erase') {
      const h = this.hitTest(wx, wy);
      if (h && h.kind !== 'walker') store.deleteObj(h);
    } else if (tool === 'calibrate') {
      this.calibPts.push({ x: wx, y: wy });
      if (this.calibPts.length === 2) { this.ui.calib = { p1: this.calibPts[0], p2: this.calibPts[1] }; }
      if (this.calibPts.length > 2) { this.calibPts = [{ x: wx, y: wy }]; this.ui.calib = null; }
      this.dirty = true;
    }
  }
  startPan(sx, sy) { this.drag = { type: 'pan', sx, sy, ox: this.view.ox, oy: this.view.oy }; }
  endWall() { this.wallDraft = null; this.hooks.onDraft?.(false); this.dirty = true; }
  resetCalibration() { this.calibPts = []; this.dirty = true; }

  startObjDrag(h, wx, wy) {
    const o = this.store.find(h); if (!o) return;
    const d = { type: 'obj', kind: h.kind, obj: o, end: h.end, sx: wx, sy: wy, moved: false, orig: JSON.parse(JSON.stringify(o)) };
    if (h.kind === 'wall') {
      const walls = this.store.plan.walls;
      d.links1 = connectedEnds(walls, o.x1, o.y1, o); d.links2 = connectedEnds(walls, o.x2, o.y2, o);
      d.linkOrig = [...d.links1, ...d.links2].map(([w]) => ({ w, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }));
    }
    this.drag = d;
  }

  onMove(e) {
    const [sx, sy] = this.evPos(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: sx, y: sy });
    if (this.pinch && this.pointers.size === 2) {
      const q = [...this.pointers.values()];
      const d = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y), mx = (q[0].x + q[1].x) / 2, my = (q[0].y + q[1].y) / 2;
      this.view.ox += mx - this.pinch.mx; this.view.oy += my - this.pinch.my;
      this.zoomAt(d / this.pinch.d, mx, my); this.pinch = { d, mx, my }; return;
    }
    const [wx, wy] = this.s2w(sx, sy), tool = this.ui.tool;
    this.hooks.onCursor?.(wx, wy);
    if (this.drag) {
      if (this.drag.type === 'pan') { this.view.ox = this.drag.ox + sx - this.drag.sx; this.view.oy = this.drag.oy + sy - this.drag.sy; this.dirty = true; }
      else if (this.drag.type === 'walker') { walker.x = wx; walker.z = wy; walker.dirty = true; this.hooks.onWalker?.(); }
      else this.dragObj(wx, wy, e.shiftKey, e.altKey);
      return;
    }
    if (tool === 'wall') this.hover = this.snapPoint(wx, wy, this.wallDraft);
    else if (tool === 'room') { if (this.roomDraft) { const q = this.snapPoint(wx, wy); this.roomDraft.x1 = q.x; this.roomDraft.y1 = q.y; } }
    else if (tool === 'door' || tool === 'window') { const nw = this.store.nearestWall(wx, wy, 0.6); this.hover = nw ? { wall: nw.wall, t: nw.t } : null; }
    else if (tool === 'place') this.hover = this.placement(this.ui.placeSku, wx, wy);
    else if (tool === 'calibrate') this.hover = { x: wx, y: wy };
    else if (tool === 'select') {
      const h = this.hitTest(wx, wy);
      this.canvas.style.cursor = !h ? 'default' : h.end ? 'pointer' : h.kind === 'wall' ? 'grab' : 'move';
    }
    this.dirty = true;
  }

  onUp(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    const store = this.store;
    if (this.roomDraft) {
      const d = this.roomDraft; this.roomDraft = null;
      const x0 = Math.min(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), x1 = Math.max(d.x0, d.x1), y1 = Math.max(d.y0, d.y1);
      if (x1 - x0 >= 0.75 && y1 - y0 >= 0.75) { const r = store.addRoom(x0, y0, x1, y1); store.select({ kind: 'room', id: r.id }); }
      this.dirty = true;
    }
    if (this.drag && this.drag.type === 'obj' && this.drag.moved) store.commit();
    this.drag = null;
  }

  dragObj(wx, wy, free, noSnap) {
    const d = this.drag, o = d.obj, dx = wx - d.sx, dy = wy - d.sy; d.moved = true;
    if (d.kind === 'furniture') {
      const nx = free ? d.orig.x + dx : snapTo(d.orig.x + dx, 0.05), ny = free ? d.orig.y + dy : snapTo(d.orig.y + dy, 0.05);
      const s = noSnap ? null : wallSnap(this.store.plan, SKU[o.sku], nx, ny);
      if (s) { o.x = s.x; o.y = s.y; o.rot = s.rot; } else { o.x = nx; o.y = ny; }
    } else if (d.kind === 'room') { const g = this.gridStep(); o.x = snapTo(d.orig.x + dx, g); o.y = snapTo(d.orig.y + dy, g); }
    else if (d.kind === 'underlay') { o.x = d.orig.x + dx; o.y = d.orig.y + dy; }
    else if (d.kind === 'opening') {
      const w = this.store.wallById(o.wall), L = wallLen(w), h = distToSeg(wx, wy, w.x1, w.y1, w.x2, w.y2), half = o.w / 2 / L;
      o.t = clamp(snapTo(h.t * L, 0.05) / L, half, 1 - half);
    } else if (d.kind === 'wall') {
      d.linkOrig.forEach((l) => { l.w.x1 = l.x1; l.w.y1 = l.y1; l.w.x2 = l.x2; l.w.y2 = l.y2; });
      if (d.end) {
        const q = this.snapPoint(wx, wy, d.end === 1 ? { x: d.orig.x2, y: d.orig.y2 } : { x: d.orig.x1, y: d.orig.y1 });
        const links = d.end === 1 ? d.links1 : d.links2;
        o['x' + d.end] = q.x; o['y' + d.end] = q.y;
        links.forEach(([w, k]) => { w['x' + k] = q.x; w['y' + k] = q.y; });
      } else {
        const g = this.gridStep(), sdx = snapTo(dx, g), sdy = snapTo(dy, g);
        o.x1 = d.orig.x1 + sdx; o.y1 = d.orig.y1 + sdy; o.x2 = d.orig.x2 + sdx; o.y2 = d.orig.y2 + sdy;
        d.links1.forEach(([w, k]) => { w['x' + k] = o.x1; w['y' + k] = o.y1; });
        d.links2.forEach(([w, k]) => { w['x' + k] = o.x2; w['y' + k] = o.y2; });
      }
    }
    this.store.touch(); this.dirty = true;
  }
}
