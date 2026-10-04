import * as THREE from 'three';

// Procedural canvas textures for floors and ground.
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function paint(kind, g) {
  if (kind === 'wood') {
    for (let i = 0; i < 8; i++) {
      const y = i * 32, off = (rnd(i) * 256) | 0;
      g.fillStyle = `hsl(${26 + rnd(i + 3) * 8},${38 + rnd(i + 9) * 12}%,${40 + rnd(i + 5) * 12}%)`; g.fillRect(0, y, 256, 32);
      g.strokeStyle = 'rgba(60,35,15,.18)';
      for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(0, y + 4 + k * 5); g.bezierCurveTo(80, y + 2 + k * 5 + rnd(i * k) * 4, 170, y + 6 + k * 5, 256, y + 4 + k * 5); g.stroke(); }
      g.fillStyle = 'rgba(40,22,10,.45)'; g.fillRect(0, y, 256, 1.5); g.fillRect(off, y, 1.5, 32);
    }
  } else if (kind === 'vitrified') {
    g.fillStyle = '#E8E3D8'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(150,140,120,${rnd(i) * 0.08})`; g.fillRect(rnd(i + 1) * 256, rnd(i + 2) * 256, 3, 3); }
    g.fillStyle = '#CFC7B8'; g.fillRect(0, 0, 256, 2); g.fillRect(0, 128, 256, 2); g.fillRect(0, 0, 2, 256); g.fillRect(128, 0, 2, 256);
  } else if (kind === 'marble') {
    g.fillStyle = '#F0EEEA'; g.fillRect(0, 0, 256, 256); g.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(110,110,120,${0.08 + rnd(i) * 0.18})`; g.beginPath();
      let x = rnd(i) * 256, y = 0; g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (rnd(i * 9 + k) - 0.5) * 70; y += 32; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(180,175,165,.6)'; g.fillRect(0, 0, 256, 1); g.fillRect(0, 0, 1, 256);
  } else if (kind === 'tile') {
    g.fillStyle = '#B6C3C7'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = `hsl(195,${14 + rnd(i * 4 + j) * 6}%,${82 + rnd(i + j * 7) * 5}%)`; g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
  } else if (kind === 'kota' || kind === 'granite') {
    const base = kind === 'kota' ? [95, 8, 52] : [240, 3, 30];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = `hsl(${base[0] + rnd(i * 2 + j) * 15},${base[1] + rnd(j + 5) * 6}%,${base[2] + rnd(i + j * 3) * 8}%)`; g.fillRect(i * 128, j * 128, 128, 128); }
    for (let i = 0; i < 1800; i++) { g.fillStyle = kind === 'granite' ? `rgba(255,255,255,${rnd(i) * 0.18})` : `rgba(40,50,40,${rnd(i) * 0.08})`; g.fillRect(rnd(i + 4) * 256, rnd(i + 8) * 256, 2, 2); }
    g.fillStyle = 'rgba(50,55,45,.5)'; g.fillRect(0, 0, 256, 1.5); g.fillRect(0, 128, 256, 1.5); g.fillRect(0, 0, 1.5, 256); g.fillRect(128, 0, 1.5, 256);
  } else if (kind === 'carpet') {
    g.fillStyle = '#7F8C9C'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) { const v = rnd(i) > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},.05)`; g.fillRect(rnd(i + 3) * 256, rnd(i + 7) * 256, 1.5, 1.5); }
  } else if (kind === 'grass') {
    g.fillStyle = '#8FA673'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${60 + rnd(i) * 60},${90 + rnd(i + 1) * 60},${40 + rnd(i + 2) * 30},.25)`; g.fillRect(rnd(i + 3) * 256, rnd(i + 4) * 256, 2, 3); }
  }
}

const cache = {};
export function texture(kind) {
  if (cache[kind]) return cache[kind];
  const c = document.createElement('canvas'); c.width = c.height = 256;
  paint(kind, c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  cache[kind] = t; return t;
}

export const FLOOR_TILE_SIZE = { tile: 1.0, wood: 1.6 }; // metres per texture repeat (default 1.2)
