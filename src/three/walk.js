import * as THREE from 'three';
import { SKU } from '../catalog/items.js';
import { bbox, distToSeg, inRotRect, wallLen } from '../lib/geometry.js';
import { walker } from '../lib/walker.js';

export const EYE = 1.6;

/** True if a person of radius r standing at (x, z) would overlap a wall or furniture. */
export function blocked(plan, x, z, r = 0.22) {
  const T = plan.settings.wallT;
  for (const w of plan.walls) {
    const h = distToSeg(x, z, w.x1, w.y1, w.x2, w.y2);
    if (h.d < T / 2 + r) {
      const L = wallLen(w), pos = h.t * L;
      const inDoor = plan.openings.some((o) => o.wall === w.id && o.type === 'door' && Math.abs(pos - o.t * L) < o.w / 2 - 0.08);
      if (!inDoor) return true;
    }
  }
  for (const f of plan.furniture) {
    const it = SKU[f.sku];
    if (!it || it.elev > 1.2 || it.model === 'rug') continue;
    if (inRotRect(x, z, f.x, f.y, it.w, it.d, f.rot, 0.12)) return true;
  }
  return false;
}

/** Choose a starting point 2 m outside the front door, facing it. */
export function initialWalkPosition(plan) {
  const b = bbox(plan), cx = (b.x0 + b.x1) / 2, cz = (b.y0 + b.y1) / 2, e = 0.01;
  const ext = (w) => w && ((Math.abs(w.y1 - b.y0) < e && Math.abs(w.y2 - b.y0) < e) || (Math.abs(w.y1 - b.y1) < e && Math.abs(w.y2 - b.y1) < e) ||
    (Math.abs(w.x1 - b.x0) < e && Math.abs(w.x2 - b.x0) < e) || (Math.abs(w.x1 - b.x1) < e && Math.abs(w.x2 - b.x1) < e));
  const door = plan.openings.find((o) => o.type === 'door' && ext(plan.walls.find((w) => w.id === o.wall)));
  if (door) {
    const w = plan.walls.find((x) => x.id === door.wall), L = wallLen(w), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
    let nx = -uy, ny = ux; const px = w.x1 + ux * door.t * L, py = w.y1 + uy * door.t * L;
    if ((cx - px) * nx + (cz - py) * ny > 0) { nx = -nx; ny = -ny; }
    Object.assign(walker, { x: px + nx * 2.2, z: py + ny * 2.2, yaw: Math.atan2(nx, ny), pitch: 0 });
  } else Object.assign(walker, { x: cx, z: cz, yaw: 0, pitch: 0 });
  walker.ready = true; walker.dirty = true;
}

/** Keyboard + on-screen pad + device-orientation walking. */
export class WalkController {
  constructor(getPlan) {
    this.getPlan = getPlan;
    this.keys = {}; this.pad = { f: 0, b: 0, l: 0, r: 0 };
    this.gyro = null; this.gyroYaw0 = null; this.useGyro = false;
    this._onOrient = (e) => this.onOrient(e);
  }
  enableGyro(on) {
    this.useGyro = on; this.gyro = null; this.gyroYaw0 = null;
    if (!on) { window.removeEventListener('deviceorientation', this._onOrient); return; }
    const add = () => window.addEventListener('deviceorientation', this._onOrient);
    try {
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then((s) => s === 'granted' && add()).catch(() => {});
      } else add();
    } catch { /* not available */ }
  }
  onOrient(e) {
    if (!this.useGyro || e.alpha == null) return;
    const d2r = THREE.MathUtils.degToRad;
    const a = d2r(e.alpha), b = d2r(e.beta), g = d2r(e.gamma), o = d2r(screen.orientation?.angle || 0);
    if (this.gyroYaw0 === null) this.gyroYaw0 = walker.yaw - a;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(b, a, -g, 'YXZ'));
    q.multiply(new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -o));
    this.gyro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.gyroYaw0).multiply(q);
  }
  look(dx, dy) {
    walker.yaw += dx * 0.004; walker.pitch = Math.max(-1.3, Math.min(1.3, walker.pitch + dy * 0.004));
    if (this.gyroYaw0 !== null) this.gyroYaw0 += dx * 0.004;
    walker.dirty = true;
  }
  tryMove(nx, nz) {
    const plan = this.getPlan();
    if (blocked(plan, walker.x, walker.z) || !blocked(plan, nx, nz)) { walker.x = nx; walker.z = nz; return; }
    if (!blocked(plan, nx, walker.z)) { walker.x = nx; return; }
    if (!blocked(plan, walker.x, nz)) walker.z = nz;
  }
  update(dt, camera) {
    const k = this.keys, p = this.pad;
    const fwd = (k.KeyW || k.ArrowUp || p.f ? 1 : 0) - (k.KeyS || k.ArrowDown || p.b ? 1 : 0);
    const turn = (k.ArrowLeft || p.l ? 1 : 0) - (k.ArrowRight || p.r ? 1 : 0);
    const strafe = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    if (turn) { walker.yaw += turn * dt * 1.6; if (this.gyroYaw0 !== null) this.gyroYaw0 += turn * dt * 1.6; }
    let yaw = walker.yaw;
    if (this.gyro) { const d = new THREE.Vector3(0, 0, -1).applyQuaternion(this.gyro); yaw = Math.atan2(-d.x, -d.z); }
    if (fwd || strafe) {
      const sp = (k.ShiftLeft ? 3.2 : 1.7) * dt, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      this.tryMove(walker.x + (fx * fwd + rx * strafe) * sp, walker.z + (fz * fwd + rz * strafe) * sp);
    }
    camera.position.set(walker.x, EYE, walker.z);
    if (this.gyro) camera.quaternion.copy(this.gyro); else camera.rotation.set(walker.pitch, walker.yaw, 0, 'YXZ');
    if (fwd || strafe || turn || this.gyro) walker.dirty = true;
  }
}
