import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bbox, rad } from '../lib/geometry.js';
import { walker } from '../lib/walker.js';
import { buildHouse, disposeHouse, PLINTH_H } from './buildHouse.js';
import { texture } from './textures.js';
import { WalkController, initialWalkPosition } from './walk.js';
import { XRManager } from './xr.js';

const SKY = new THREE.Color('#C9D9E2');

/** The live 3D view: scene, cameras, orbit/walk/cardboard modes, picking, XR and export. */
export class Viewport {
  constructor(container, { getPlan, onPick, overlayEl }) {
    this.container = container; this.getPlan = getPlan; this.onPick = onPick;
    this.mode = 'orbit'; this.objMap = new Map(); this.selHelper = null; this.active = false;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.xr.enabled = true;
    container.appendChild(r.domElement);

    const scene = (this.scene = new THREE.Scene());
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 400);
    this.dolly = new THREE.Group(); this.dolly.add(this.camera); scene.add(this.dolly);
    scene.add(new THREE.HemisphereLight(0xEAF2F7, 0x8A8A78, 1.4));
    this.sun = new THREE.DirectionalLight(0xFFF3DF, 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun, this.sun.target);
    const gt = texture('grass').clone(); gt.needsUpdate = true; gt.repeat.set(120, 120);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ map: gt }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -PLINTH_H; this.ground.receiveShadow = true;
    scene.add(this.ground);
    this.house = new THREE.Group(); scene.add(this.house);
    this.restoreSceneLook();

    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.49; this.controls.minDistance = 1.5; this.controls.maxDistance = 120;
    this.controls.screenSpacePanning = false;

    this.stereo = new THREE.StereoCamera(); this.stereo.aspect = 0.5; this.stereo.eyeSep = 0.064;
    this.walk = new WalkController(() => this.plan);
    this.xr = new XRManager(this, overlayEl);
    this.ray = new THREE.Raycaster();

    this.bindPointer(); this.bindKeys();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(container);
    this.clock = new THREE.Clock();
    r.setAnimationLoop((t, frame) => this.frame(frame));
  }

  get plan() { return this.getPlan(); }

  destroy() {
    this.renderer.setAnimationLoop(null); this._ro.disconnect();
    window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku);
    this.renderer.dispose();
  }
  restoreSceneLook() { this.scene.background = SKY; this.scene.fog = new THREE.Fog(SKY, 60, 160); this.ground.visible = true; }
  afterXR() {
    this.resize(); this.controls.enabled = this.mode === 'orbit';
    walker.active = this.mode !== 'orbit'; walker.dirty = true;
    if (this.mode === 'orbit') this.fitCamera(); this.setSelection(this._sel);
  }

  /* ---------- scene content ---------- */
  rebuild() {
    disposeHouse(this.house); this.house.clear(); this.selHelper = null;
    const { root, objMap } = buildHouse(this.plan);
    this.house.add(root); this.objMap = objMap;
    this.updateSun(); this.setSelection(this._sel);
  }
  setSelection(sel) {
    this._sel = sel;
    this.setSelectionHelper(sel && !this.xr.presenting ? this.objMap.get(sel.id) : null);
  }
  setSelectionHelper(obj) {
    if (this.selHelper) { this.selHelper.parent?.remove(this.selHelper); this.selHelper.geometry.dispose(); this.selHelper = null; }
    if (!obj) return;
    const b = new THREE.Box3().setFromObject(obj); b.expandByScalar(0.03);
    const col = getComputedStyle(document.documentElement).getPropertyValue('--sel').trim() || '#D17A22';
    this.selHelper = new THREE.Box3Helper(b, new THREE.Color(col)); this.house.add(this.selHelper);
  }
  updateSun() {
    const p = this.plan, s = p.settings, b = bbox(p), cx = (b.x0 + b.x1) / 2, cz = (b.y0 + b.y1) / 2, size = Math.max(b.x1 - b.x0, b.y1 - b.y0, 8);
    const n = rad(s.north), nx = Math.sin(n), ny = -Math.cos(n), ex = -ny, ey = nx, sx = -nx, sy = -ny;
    const phi = ((s.sun - 6) / 12) * Math.PI;
    const hx = ex * Math.cos(phi) + sx * Math.sin(phi), hy = ey * Math.cos(phi) + sy * Math.sin(phi);
    const el = Math.max(0.08, Math.sin(phi) * 1.2), dist = 40;
    this.sun.position.set(cx + hx * Math.cos(el) * dist, Math.sin(el) * dist, cz + hy * Math.cos(el) * dist);
    this.sun.target.position.set(cx, 0, cz);
    const sc = this.sun.shadow.camera, ext = size * 0.9 + 4;
    Object.assign(sc, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: dist * 2 + size }); sc.updateProjectionMatrix();
    const warm = 1 - Math.sin(phi);
    this.sun.color.setRGB(1, 0.95 - warm * 0.15, 0.87 - warm * 0.3);
    this.sun.intensity = 1.4 + Math.sin(phi) * 1.6;
  }

  /* ---------- cameras ---------- */
  fitCamera() {
    const b = bbox(this.plan), cx = (b.x0 + b.x1) / 2, cz = (b.y0 + b.y1) / 2, r = Math.max(b.x1 - b.x0, b.y1 - b.y0, 6) * 1.25;
    this.controls.target.set(cx, 0, cz);
    this.camera.position.set(cx - r * 0.55, r * 0.85, cz + r * 0.9);
    this.camera.lookAt(cx, 0, cz); this.controls.update();
  }
  initWalk() { initialWalkPosition(this.plan); }
  setMode(m) {
    const prev = this.mode;
    this.mode = m;
    this.controls.enabled = m === 'orbit';
    walker.active = m !== 'orbit'; walker.dirty = true;
    this.walk.enableGyro(m === 'stereo');
    if (m === 'orbit') { this.camera.fov = 55; this._orbitSaved ? this.restoreOrbit() : this.fitCamera(); }
    else {
      if (prev === 'orbit') this.saveOrbit();
      if (!walker.ready) this.initWalk();
      this.camera.fov = m === 'stereo' ? 80 : 65;
    }
    this.camera.updateProjectionMatrix(); this.setSelection(this._sel);
  }
  saveOrbit() { this._orbitSaved = { p: this.camera.position.clone(), t: this.controls.target.clone() }; }
  restoreOrbit() { this.camera.position.copy(this._orbitSaved.p); this.controls.target.copy(this._orbitSaved.t); this._orbitSaved = null; this.controls.update(); }

  resize() {
    if (this.renderer.xr.isPresenting) return;
    const w = this.container.clientWidth, h = this.container.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  /* ---------- input ---------- */
  bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => {
      this.active = true;
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, id: e.pointerId };
      if (this.mode !== 'orbit') el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY; down.moved += Math.abs(dx) + Math.abs(dy);
      if (this.mode !== 'orbit') this.walk.look(dx, dy);
    });
    el.addEventListener('pointerup', (e) => {
      if (down && down.moved < 5 && this.mode === 'orbit') this.pick(e);
      down = null;
    });
    el.addEventListener('pointercancel', () => { down = null; });
    el.addEventListener('pointerleave', () => { if (this.mode === 'orbit') this.active = false; });
  }
  bindKeys() {
    const codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft'];
    this._kd = (e) => {
      const t = e.target; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      if (this.mode !== 'orbit' && this.active && codes.includes(e.code)) { this.walk.keys[e.code] = true; e.preventDefault(); e.stopImmediatePropagation(); }
    };
    this._ku = (e) => { this.walk.keys[e.code] = false; };
    window.addEventListener('keydown', this._kd, true); window.addEventListener('keyup', this._ku);
    window.addEventListener('blur', () => { this.walk.keys = {}; });
  }
  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const hit = this.ray.intersectObjects(this.house.children, true).find((h) => h.object.userData.pick);
    this.onPick?.(hit ? hit.object.userData.pick : null);
  }

  /* ---------- render loop ---------- */
  frame(xrFrame) {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.renderer.xr.isPresenting) { this.xr.update(dt, xrFrame); this.renderer.render(this.scene, this.camera); return; }
    if (!this.container.clientWidth || this.container.offsetParent === null) return;
    if (this.mode === 'orbit') this.controls.update(); else this.walk.update(dt, this.camera);
    if (this.mode === 'stereo') this.renderStereo(); else this.renderer.render(this.scene, this.camera);
  }
  renderStereo() {
    const r = this.renderer; this.camera.updateMatrixWorld(); this.stereo.update(this.camera);
    const sz = r.getSize(new THREE.Vector2()); r.setScissorTest(true);
    r.setScissor(0, 0, sz.x / 2, sz.y); r.setViewport(0, 0, sz.x / 2, sz.y); r.render(this.scene, this.stereo.cameraL);
    r.setScissor(sz.x / 2, 0, sz.x / 2, sz.y); r.setViewport(sz.x / 2, 0, sz.x / 2, sz.y); r.render(this.scene, this.stereo.cameraR);
    r.setScissorTest(false); r.setViewport(0, 0, sz.x, sz.y);
  }

  /* ---------- export ---------- */
  exportScene() {
    const root = this.house.children[0]?.clone(true) || new THREE.Group();
    const strip = []; root.traverse((o) => { if (o.userData.noExport || o.isLineSegments) strip.push(o); });
    strip.forEach((o) => o.parent?.remove(o));
    const s = new THREE.Scene(); s.add(root); return s;
  }
  async exportGLB() {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const buf = await new GLTFExporter().parseAsync(this.exportScene(), { binary: true });
    return new Blob([buf], { type: 'model/gltf-binary' });
  }
  async exportUSDZ() {
    const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
    const data = await new USDZExporter().parseAsync(this.exportScene());
    return new Blob([data], { type: 'model/vnd.usdz+zip' });
  }
}
