import * as THREE from 'three';
import { bbox } from '../lib/geometry.js';
import { walker, } from '../lib/walker.js';
import { PLINTH_H } from './buildHouse.js';

/**
 * WebXR sessions: full-scale walk-through in VR, and a tabletop or full-size
 * model in AR with hit-test placement. Talks to the Viewport through `vp`.
 */
export class XRManager {
  constructor(vp, overlayEl) {
    this.vp = vp; this.overlay = overlayEl;
    this.kind = null; this.session = null; this.hitSource = null; this.lastHit = null;
    this.arScale = 1 / 25; this.snapCool = 0; this._v = new THREE.Vector3();
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.11, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.reticle.matrixAutoUpdate = false; this.reticle.visible = false; vp.scene.add(this.reticle);
  }
  get presenting() { return this.vp.renderer.xr.isPresenting; }

  async supported(kind) {
    if (!window.isSecureContext || !navigator.xr) return false;
    try { return await navigator.xr.isSessionSupported(kind); } catch { return false; }
  }

  /** Returns an error message, or null on success. */
  async start(kind) {
    if (!(await this.supported(kind))) {
      return kind === 'immersive-vr'
        ? 'VR needs a WebXR headset browser (for example the Meta Quest Browser) and an HTTPS address.'
        : 'AR needs Chrome on an ARCore Android phone and an HTTPS address. On iPhone, use Export → USDZ for AR Quick Look.';
    }
    const vp = this.vp;
    try {
      const opts = kind === 'immersive-ar'
        ? { optionalFeatures: ['local-floor', 'hit-test', 'dom-overlay'], domOverlay: { root: this.overlay } }
        : { optionalFeatures: ['local-floor', 'bounded-floor'] };
      const session = await navigator.xr.requestSession(kind, opts);
      this.kind = kind; this.session = session;
      vp.renderer.xr.setReferenceSpaceType('local-floor');
      vp.camera.position.set(0, 0, 0); vp.camera.rotation.set(0, 0, 0);
      vp.controls.enabled = false;
      await vp.renderer.xr.setSession(session);
      session.addEventListener('end', () => this.onEnd());
      vp.setSelectionHelper(null);
      if (kind === 'immersive-ar') {
        vp.scene.background = null; vp.scene.fog = null; vp.ground.visible = false;
        this.overlay.hidden = false;
        this.place(new THREE.Vector3(0, 0, -1.2));
        try {
          const space = await session.requestReferenceSpace('viewer');
          this.hitSource = await session.requestHitTestSource({ space });
        } catch { this.hitSource = null; }
        session.addEventListener('select', () => { if (this.lastHit) this.place(this.lastHit); });
      } else {
        if (!walker.ready) vp.initWalk();
        vp.dolly.position.set(walker.x, 0, walker.z); vp.dolly.rotation.set(0, walker.yaw, 0);
        walker.active = true;
      }
      return null;
    } catch (err) {
      this.kind = null;
      return `Could not start ${kind === 'immersive-vr' ? 'VR' : 'AR'}: ${err?.message || 'the browser refused the session.'}`;
    }
  }
  end() { this.session?.end(); }

  setScale(s) { this.arScale = s; this.place(this.lastHit || new THREE.Vector3(0, 0, s === 1 ? -2 : -1.2)); }
  place(p) {
    const vp = this.vp, b = bbox(vp.plan), cx = (b.x0 + b.x1) / 2, cz = (b.y0 + b.y1) / 2, k = this.arScale;
    vp.house.scale.setScalar(k);
    vp.house.position.set(p.x - cx * k, p.y + PLINTH_H * k, p.z - cz * k);
  }

  onEnd() {
    const vp = this.vp;
    try { this.hitSource?.cancel(); } catch { /* already gone */ }
    this.hitSource = null; this.lastHit = null; this.reticle.visible = false; this.overlay.hidden = true;
    vp.restoreSceneLook();
    vp.house.scale.setScalar(1); vp.house.position.set(0, 0, 0);
    if (this.kind === 'immersive-vr') { walker.x = vp.dolly.position.x; walker.z = vp.dolly.position.z; walker.yaw = vp.dolly.rotation.y; }
    vp.dolly.position.set(0, 0, 0); vp.dolly.rotation.set(0, 0, 0);
    this.kind = null; this.session = null;
    setTimeout(() => vp.afterXR(), 50);
  }

  update(dt, frame) {
    const vp = this.vp;
    if (this.kind === 'immersive-ar' && frame && this.hitSource) {
      const res = frame.getHitTestResults(this.hitSource);
      const pose = res.length ? res[0].getPose(vp.renderer.xr.getReferenceSpace()) : null;
      if (pose) { this.reticle.visible = true; this.reticle.matrix.fromArray(pose.transform.matrix); this.lastHit = new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix); }
      else this.reticle.visible = false;
    }
    if (this.kind === 'immersive-vr' && this.session) {
      this.snapCool -= dt;
      for (const src of this.session.inputSources) {
        const gp = src.gamepad; if (!gp || gp.axes.length < 4) continue;
        const ax = gp.axes[2], ay = gp.axes[3];
        if (src.handedness === 'right') {
          if (Math.abs(ax) > 0.6 && this.snapCool <= 0) { vp.dolly.rotation.y -= Math.sign(ax) * Math.PI / 6; this.snapCool = 0.35; }
        } else if (Math.abs(ax) > 0.15 || Math.abs(ay) > 0.15) {
          vp.renderer.xr.getCamera().getWorldDirection(this._v); this._v.y = 0; this._v.normalize();
          const rx = -this._v.z, rz = this._v.x, sp = 1.6 * dt;
          vp.dolly.position.x += (this._v.x * -ay + rx * ax) * sp; vp.dolly.position.z += (this._v.z * -ay + rz * ax) * sp;
          walker.x = vp.dolly.position.x; walker.z = vp.dolly.position.z; walker.dirty = true;
        }
      }
    }
  }
}
