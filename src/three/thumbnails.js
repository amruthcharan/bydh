import * as THREE from 'three';
import { SKU } from '../catalog/items.js';
import { buildFurnitureModel } from './furniture/index.js';

// Renders small product images for the store, one at a time, on a shared offscreen renderer.
let renderer, scene, camera;
const cache = new Map();
let queue = Promise.resolve();

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(240, 180, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a7a, 2.2));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(3, 5, 4); scene.add(d);
  camera = new THREE.PerspectiveCamera(30, 240 / 180, 0.05, 50);
}

function render(sku, color) {
  if (!renderer) setup();
  const it = SKU[sku]; if (!it) return '';
  const g = buildFurnitureModel({ ...it, elev: 0 }, color);
  g.rotation.y = -0.6; scene.add(g);
  const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) * 0.62 + 0.1, dist = r / Math.tan((camera.fov * Math.PI) / 360);
  camera.position.set(c.x + dist * 0.55, c.y + dist * 0.5, c.z + dist * 0.75); camera.lookAt(c);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(g); g.traverse((o) => o.isMesh && o.geometry.dispose());
  return url;
}

/** Promise for a data-URL thumbnail of a catalogue item in a colour. */
export function thumbnail(sku, color) {
  const key = sku + (color || '');
  if (cache.has(key)) return cache.get(key);
  const p = (queue = queue.then(() => new Promise((res) => {
    requestAnimationFrame(() => { try { res(render(sku, color)); } catch { res(''); } });
  })));
  cache.set(key, p);
  return p;
}
