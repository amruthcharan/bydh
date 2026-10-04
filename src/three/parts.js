import * as THREE from 'three';

// Shared materials and primitive helpers used by every furniture model.
export const M = {
  wall: new THREE.MeshStandardMaterial({ color: 0xF4F1EA, roughness: 0.92 }),
  plinth: new THREE.MeshStandardMaterial({ color: 0xB9B2A4, roughness: 0.95 }),
  door: new THREE.MeshStandardMaterial({ color: 0x7A5134, roughness: 0.6 }),
  frame: new THREE.MeshStandardMaterial({ color: 0xE8EAE6, roughness: 0.5 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9EC3D3, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false }),
  dark: new THREE.MeshStandardMaterial({ color: 0x22262A, roughness: 0.4 }),
  white: new THREE.MeshStandardMaterial({ color: 0xF3F3F1, roughness: 0.35 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xB8BEC2, roughness: 0.3, metalness: 0.7 }),
  granite: new THREE.MeshStandardMaterial({ color: 0x2E2F31, roughness: 0.3 }),
  linen: new THREE.MeshStandardMaterial({ color: 0xF2EFE8, roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4F7F45, roughness: 0.8, flatShading: true }),
  gold: new THREE.MeshStandardMaterial({ color: 0xD3A443, roughness: 0.35, metalness: 0.6 }),
  water: new THREE.MeshStandardMaterial({ color: 0xBFE0EA, roughness: 0.1 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xCFD8DC, roughness: 0.05, metalness: 0.95 }),
  lampShade: new THREE.MeshStandardMaterial({ color: 0xF5EBD8, roughness: 0.9, emissive: 0x6b5a3a, emissiveIntensity: 0.4 }),
};

const colorMats = new Map();
/** One cached material per colour, so recolouring never leaks GPU memory. */
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!colorMats.has(key)) colorMats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...opts }));
  return colorMats.get(key);
}
export function tint(color, toward = '#ffffff', k = 0.45) {
  return '#' + new THREE.Color(color).lerp(new THREE.Color(toward), k).getHexString();
}

export function box(g, w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
export function cyl(g, rt, rb, h, material, x = 0, y = 0, z = 0, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
