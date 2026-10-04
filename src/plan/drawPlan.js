import { SKU, FLOORS } from '../catalog/items.js';
import { clamp, wallLen, rad } from '../lib/geometry.js';
import { fmtArea, fmtLen } from '../lib/units.js';
import { walker } from '../lib/walker.js';

/** Read the CSS colour tokens so the canvas follows the light/dark theme. */
export function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const t = {};
  for (const k of ['paper', 'panel', 'ink', 'muted', 'line', 'grid', 'grid-major', 'accent', 'sel', 'danger']) t[k] = cs.getPropertyValue('--' + k).trim();
  t.fDisplay = cs.getPropertyValue('--f-display').trim();
  t.fMono = cs.getPropertyValue('--f-mono').trim();
  return t;
}

/** Draws the whole plan. `ed` is the PlanEditor (view transform + interaction state). */
export function drawPlan(ed) {
  const { ctx, tk } = ed;
  const plan = ed.store.plan, sel = ed.store.sel, units = plan.settings.units;
  const W = ed.canvas.clientWidth, H = ed.canvas.clientHeight;
  if (!W || !H) return;
  const s = ed.view.s, w2s = (x, y) => ed.w2s(x, y);
  ctx.setTransform(ed.dpr, 0, 0, ed.dpr, 0, 0);
  ctx.fillStyle = tk.paper; ctx.fillRect(0, 0, W, H);

  // Tracing image
  const u = plan.underlay;
  if (u && u.visible && ed.underlayImg()) {
    const [cx, cy] = w2s(u.x, u.y);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rad(u.rot)); ctx.globalAlpha = u.opacity;
    const iw = u.w * u.mpp * s, ih = u.h * u.mpp * s;
    ctx.drawImage(ed.underlayImg(), -iw / 2, -ih / 2, iw, ih);
    ctx.globalAlpha = 1;
    if (sel && sel.kind === 'underlay') { ctx.strokeStyle = tk.sel; ctx.setLineDash([8, 5]); ctx.lineWidth = 1.5; ctx.strokeRect(-iw / 2, -ih / 2, iw, ih); ctx.setLineDash([]); }
    ctx.restore();
  }

  // Grid
  const [gx0, gy0] = ed.s2w(0, 0), [gx1, gy1] = ed.s2w(W, H);
  const minor = s > 55 ? 0.25 : s > 22 ? 0.5 : 1, major = s > 14 ? 1 : 5;
  ctx.lineWidth = 1;
  for (const [step, col] of [[minor, tk.grid], [major, tk['grid-major']]]) {
    ctx.strokeStyle = col; ctx.globalAlpha = u && u.visible ? 0.55 : 1; ctx.beginPath();
    for (let x = Math.floor(gx0 / step) * step; x <= gx1; x += step) { const sx = Math.round(x * s + ed.view.ox) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
    for (let y = Math.floor(gy0 / step) * step; y <= gy1; y += step) { const sy = Math.round(y * s + ed.view.oy) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(W, sy); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  // Rooms
  for (const r of plan.rooms) {
    const [x, y] = w2s(r.x, r.y);
    ctx.globalAlpha = 0.28; ctx.fillStyle = (FLOORS[r.floor] || FLOORS.vitrified).color;
    ctx.fillRect(x, y, r.w * s, r.h * s); ctx.globalAlpha = 1;
    if (sel && sel.kind === 'room' && sel.id === r.id) {
      ctx.strokeStyle = tk.sel; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(x + 1, y + 1, r.w * s - 2, r.h * s - 2); ctx.setLineDash([]);
    }
  }

  // Furniture (floor items first, wall-mounted items dashed on top)
  const items = plan.furniture.slice().sort((a, b) => (SKU[a.sku]?.elev || 0) - (SKU[b.sku]?.elev || 0));
  for (const f of items) {
    const it = SKU[f.sku]; if (!it) continue;
    const isSel = sel && sel.kind === 'furniture' && sel.id === f.id;
    drawItem(ctx, tk, w2s(f.x, f.y), it, f.rot, s, f.color || it.colors[0], isSel);
  }

  // Walls
  const T = Math.max(plan.settings.wallT * s, 2.5);
  ctx.lineCap = 'square';
  for (const w of plan.walls) {
    const [a, b] = w2s(w.x1, w.y1), [c, d] = w2s(w.x2, w.y2);
    ctx.strokeStyle = sel && sel.kind === 'wall' && sel.id === w.id ? tk.sel : tk.ink; ctx.lineWidth = T;
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
  }

  // Doors & windows
  ctx.lineCap = 'butt';
  for (const o of plan.openings) {
    const w = ed.store.wallById(o.wall); if (!w) continue;
    const L = wallLen(w); if (L < 0.01) continue;
    const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, nx = -uy, ny = ux;
    const c0 = o.t * L - o.w / 2, c1 = o.t * L + o.w / 2;
    const A = w2s(w.x1 + ux * c0, w.y1 + uy * c0), B = w2s(w.x1 + ux * c1, w.y1 + uy * c1);
    ctx.strokeStyle = tk.paper; ctx.lineWidth = T + 2;
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
    const isSel = sel && sel.kind === 'opening' && sel.id === o.id;
    ctx.strokeStyle = isSel ? tk.sel : tk.ink; ctx.lineWidth = 1.2;
    const hT = T / 2;
    ctx.beginPath();
    ctx.moveTo(A[0] + nx * hT, A[1] + ny * hT); ctx.lineTo(A[0] - nx * hT, A[1] - ny * hT);
    ctx.moveTo(B[0] + nx * hT, B[1] + ny * hT); ctx.lineTo(B[0] - nx * hT, B[1] - ny * hT);
    ctx.stroke();
    if (o.type === 'door') {
      // flip: which side of the wall the leaf opens to. hingeEnd: hinge at the wall's end side (B) instead of its start side (A).
      const sd = o.flip ? -1 : 1, hinge = o.hingeEnd ? B : A, dir = o.hingeEnd ? -1 : 1;
      const r = o.w * s, hx = hinge[0] + nx * sd * hT, hy = hinge[1] + ny * sd * hT;
      ctx.lineWidth = isSel ? 2.2 : 1.6;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + nx * sd * r, hy + ny * sd * r); ctx.stroke();
      const a0 = Math.atan2(ny * sd, nx * sd), a1 = Math.atan2(uy * dir, ux * dir);
      let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(hx, hy, r, a0, a0 + da, da < 0); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.lineWidth = isSel ? 1.8 : 1;
      for (const k of [-0.55, 0, 0.55]) { ctx.beginPath(); ctx.moveTo(A[0] + nx * hT * k, A[1] + ny * hT * k); ctx.lineTo(B[0] + nx * hT * k, B[1] + ny * hT * k); ctx.stroke(); }
    }
  }

  // Room labels
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const r of plan.rooms) {
    if (r.w * s < 50) continue;
    const [x, y] = w2s(r.x + r.w / 2, r.y + r.h / 2);
    const fs = clamp(s * 0.34, 11, 17), t1 = r.name.toUpperCase(), t2 = fmtArea(r.w * r.h, units);
    ctx.font = `600 ${fs}px ${tk.fDisplay}`; const w1 = ctx.measureText(t1).width;
    ctx.font = `400 ${fs * 0.72}px ${tk.fMono}`; const w2 = ctx.measureText(t2).width;
    const bw = Math.max(w1, w2) + 12, bh = fs * 1.95 + 6;
    ctx.globalAlpha = 0.85; ctx.fillStyle = tk.paper; ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh); ctx.globalAlpha = 1;
    ctx.fillStyle = tk.ink; ctx.font = `600 ${fs}px ${tk.fDisplay}`; ctx.fillText(t1, x, y - fs * 0.42);
    ctx.fillStyle = tk.muted; ctx.font = `400 ${fs * 0.72}px ${tk.fMono}`; ctx.fillText(t2, x, y + fs * 0.55);
  }

  // Dimensions for the selection
  const sw = sel && sel.kind === 'wall' ? ed.store.wallById(sel.id) : null;
  if (sw) dimLine(ed, sw.x1, sw.y1, sw.x2, sw.y2, tk.sel);
  const sr = sel && sel.kind === 'room' ? plan.rooms.find((r) => r.id === sel.id) : null;
  if (sr) { dimLine(ed, sr.x, sr.y, sr.x + sr.w, sr.y, tk.sel); dimLine(ed, sr.x + sr.w, sr.y, sr.x + sr.w, sr.y + sr.h, tk.sel); }

  // Tool previews
  const tool = ed.ui.tool, hov = ed.hover;
  if (tool === 'wall' && hov) {
    const [hx, hy] = w2s(hov.x, hov.y);
    ctx.fillStyle = tk.accent; ctx.beginPath(); ctx.arc(hx, hy, hov.snapped ? 6 : 4, 0, 7); ctx.fill();
    if (ed.wallDraft) {
      const [ax, ay] = w2s(ed.wallDraft.x, ed.wallDraft.y);
      ctx.strokeStyle = tk.accent; ctx.globalAlpha = 0.6; ctx.lineWidth = T; ctx.lineCap = 'square';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.stroke(); ctx.globalAlpha = 1;
      dimLine(ed, ed.wallDraft.x, ed.wallDraft.y, hov.x, hov.y, tk.accent);
    }
  }
  if (ed.roomDraft) {
    const d = ed.roomDraft;
    const x0 = Math.min(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), x1 = Math.max(d.x0, d.x1), y1 = Math.max(d.y0, d.y1);
    const [a, b] = w2s(x0, y0), [c, e] = w2s(x1, y1);
    ctx.fillStyle = tk.accent; ctx.globalAlpha = 0.12; ctx.fillRect(a, b, c - a, e - b); ctx.globalAlpha = 1;
    ctx.strokeStyle = tk.accent; ctx.lineWidth = T; ctx.strokeRect(a, b, c - a, e - b);
    dimLine(ed, x0, y0, x1, y0, tk.accent); dimLine(ed, x1, y0, x1, y1, tk.accent);
  }
  if ((tool === 'door' || tool === 'window') && hov && hov.wall) {
    const w = hov.wall, L = wallLen(w), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, ow = tool === 'door' ? 0.9 : 1.2;
    const A = w2s(w.x1 + ux * (hov.t * L - ow / 2), w.y1 + uy * (hov.t * L - ow / 2)), B = w2s(w.x1 + ux * (hov.t * L + ow / 2), w.y1 + uy * (hov.t * L + ow / 2));
    ctx.strokeStyle = tk.accent; ctx.lineWidth = T + 4; ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (tool === 'place' && hov && hov.item) {
    ctx.globalAlpha = 0.65;
    drawItem(ctx, tk, w2s(hov.x, hov.y), hov.item, hov.rot, s, ed.ui.placeColor || hov.item.colors[0], true);
    ctx.globalAlpha = 1;
  }
  if (tool === 'calibrate' && ed.calibPts.length) {
    const pts = ed.calibPts.concat(ed.calibPts.length === 1 && hov ? [hov] : []);
    ctx.strokeStyle = tk.sel; ctx.fillStyle = tk.sel; ctx.lineWidth = 2;
    if (pts.length === 2) { const [a, b] = w2s(pts[0].x, pts[0].y), [c, d] = w2s(pts[1].x, pts[1].y); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
    for (const p of pts) { const [x, y] = w2s(p.x, p.y); ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); }
  }

  // Walk-through marker
  if (walker.active) {
    const [x, y] = w2s(walker.x, walker.z);
    const a = Math.atan2(-Math.cos(walker.yaw), -Math.sin(walker.yaw)), r = Math.max(28, s * 1.4);
    ctx.fillStyle = tk.accent; ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, a - 0.5, a + 0.5); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = tk.paper; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.stroke();
  }
  drawNorth(ctx, tk, W, plan.settings.north);
}

function drawItem(ctx, tk, [x, y], it, rot, s, color, highlight) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rad(rot));
  const w = it.w * s, h = it.d * s, alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * (it.elev > 0 ? 0.18 : 0.5); ctx.fillStyle = color; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.globalAlpha = alpha;
  ctx.strokeStyle = highlight ? tk.sel : tk.ink; ctx.lineWidth = highlight ? 2 : 1;
  if (it.elev > 0) ctx.setLineDash([5, 3]);
  ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.setLineDash([]);
  if (!it.elev) { ctx.beginPath(); ctx.moveTo(-w / 2 + 3, h / 2 - 3); ctx.lineTo(w / 2 - 3, h / 2 - 3); ctx.lineWidth = highlight ? 2 : 1.5; ctx.stroke(); }
  glyph(ctx, tk, it, w, h);
  ctx.restore();
}

function glyph(ctx, tk, it, w, h) {
  ctx.lineWidth = 1; ctx.strokeStyle = tk.ink; const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * 0.55; ctx.beginPath();
  const m = it.model, p = it.params || {};
  if (m === 'bed' || m === 'bunk') { const ph = Math.min(h * 0.16, w * 0.3); ctx.rect(-w / 2 + 4, -h / 2 + 4, w - 8, ph); if ((p.pillows || 1) > 1) { ctx.moveTo(0, -h / 2 + 4); ctx.lineTo(0, -h / 2 + 4 + ph); } ctx.moveTo(-w / 2, -h / 2 + h * 0.38); ctx.lineTo(w / 2, -h / 2 + h * 0.38); }
  else if (m === 'sofa' || m === 'recliner') { const a = Math.min(w * 0.12, h * 0.25); ctx.rect(-w / 2, -h / 2, w, h * 0.28); ctx.rect(-w / 2, -h / 2, a, h); ctx.rect(w / 2 - a, -h / 2, a, h); }
  else if (m === 'lsofa') { ctx.rect(-w / 2, -h / 2, w, h * 0.13); ctx.rect(w / 2 - w * 0.08, -h / 2, w * 0.08, h); ctx.moveTo(w / 2 - w * 0.35, -h / 2 + h * 0.53); ctx.lineTo(w / 2 - w * 0.35, h / 2); ctx.lineTo(w / 2, h / 2); }
  else if (m === 'dining') { if (p.round) ctx.arc(0, 0, Math.min(w, h) * 0.31, 0, 7); else ctx.rect(-w / 2 + 0.2 / 1.6 * w, -h * 0.27, w - 0.4 / 1.6 * w, h * 0.54); }
  else if (m === 'table') { if (p.round) ctx.arc(0, 0, Math.min(w, h) * 0.45, 0, 7); else ctx.rect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6); }
  else if (m === 'wc') { ctx.rect(-w / 2, -h / 2, w, h * 0.25); ctx.ellipse(0, h * 0.12, w * 0.42, h * 0.3, 0, 0, 7); }
  else if (m === 'tub') { ctx.roundRect ? ctx.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, Math.min(w, h) * 0.3) : ctx.rect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10); }
  else if (m === 'basin' || m === 'vanity') ctx.ellipse(0, h * 0.05, w * 0.3, h * 0.28, 0, 0, 7);
  else if (m === 'plant') { ctx.arc(0, 0, Math.min(w, h) * 0.42, 0, 7); ctx.moveTo(-w * 0.25, 0); ctx.lineTo(w * 0.25, 0); ctx.moveTo(0, -h * 0.25); ctx.lineTo(0, h * 0.25); }
  else if (m === 'base') { if (p.sink) { ctx.rect(-w * 0.28, -h * 0.3, w * 0.56, h * 0.55); } else if (p.hob) { for (const sx of [-0.22, 0.22]) for (const sy of [-0.18, 0.18]) { ctx.moveTo(sx * w + h * 0.1, sy * h); ctx.arc(sx * w, sy * h, h * 0.1, 0, 7); } } else { ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); } }
  else if (m === 'wardrobe' || m === 'crockery' || m === 'shelf' || m === 'tall' || m === 'shoeRack') { ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.moveTo(w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2); }
  else if (m === 'fridge' || m === 'washer') { ctx.rect(-w * 0.35, -h * 0.35, w * 0.7, h * 0.7); }
  else if (m === 'tvUnit') ctx.rect(-w * 0.32, -h * 0.15, w * 0.64, h * 0.12);
  else if (m === 'shower') { ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.moveTo(w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2); ctx.moveTo(w * 0.12, 0); ctx.arc(0, 0, w * 0.12, 0, 7); }
  else if (m === 'pooja') { ctx.moveTo(-w * 0.25, h * 0.2); ctx.lineTo(0, -h * 0.25); ctx.lineTo(w * 0.25, h * 0.2); }
  else if (m === 'swing') { ctx.rect(-w * 0.4, -h * 0.3, w * 0.8, h * 0.6); }
  else if (m === 'officeChair') { ctx.arc(0, 0, Math.min(w, h) * 0.42, 0, 7); }
  else if (m === 'desk' || m === 'ldesk' || m === 'breakfast') { ctx.rect(-w * 0.15, h * 0.2, w * 0.3, h * 0.25); }
  ctx.stroke(); ctx.globalAlpha = a0;
}

function dimLine(ed, x1, y1, x2, y2, col) {
  const { ctx, tk } = ed; const L = Math.hypot(x2 - x1, y2 - y1); if (L < 0.05) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux, off = ed.store.plan.settings.wallT / 2 + 0.35;
  const A = ed.w2s(x1 + nx * off, y1 + ny * off), B = ed.w2s(x2 + nx * off, y2 + ny * off);
  ctx.strokeStyle = col; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
  for (const P of [A, B]) { ctx.beginPath(); ctx.moveTo(P[0] - nx * 5 - ux * 5, P[1] - ny * 5 - uy * 5); ctx.lineTo(P[0] + nx * 5 + ux * 5, P[1] + ny * 5 + uy * 5); ctx.stroke(); }
  const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, txt = fmtLen(L, ed.store.plan.settings.units);
  ctx.font = `500 11px ${tk.fMono}`; const tw = ctx.measureText(txt).width + 8;
  ctx.fillStyle = tk.paper; ctx.fillRect(mx - tw / 2, my - 8, tw, 16);
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, mx, my);
}

function drawNorth(ctx, tk, W, north) {
  const cx = W - 74, cy = 28, r = 15;
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = tk.panel; ctx.strokeStyle = tk.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, 7); ctx.fill(); ctx.stroke();
  ctx.rotate(rad(north)); ctx.fillStyle = tk.ink;
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(5, 4); ctx.lineTo(0, 1); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
  ctx.font = `700 10px ${tk.fDisplay}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = tk.accent; ctx.fillText('N', 0, 9);
  ctx.restore();
}
