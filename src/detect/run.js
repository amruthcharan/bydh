// Detect walls and rooms in the tracing image and return them in plan metres.

import { modelFiles } from './model.js';
import { toPlan } from './place.js';

const RES = 0.025; // working resolution, metres per pixel (the model is trained around this)
const MAX_SIDE = 2400;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The tracing image couldn’t be read. Import it again.'));
    img.src = src;
  });
}

/** Greyscale pixels of the underlay, resampled so one pixel is about `RES` metres. */
async function grayscale(u) {
  const img = await loadImage(u.src);
  let res = RES;
  const wm = u.w * u.mpp,
    hm = u.h * u.mpp;
  if (Math.max(wm, hm) / res > MAX_SIDE) res = Math.max(wm, hm) / MAX_SIDE;
  const W = Math.max(16, Math.round(wm / res)),
    H = Math.max(16, Math.round(hm / res));
  const c = new OffscreenCanvas(W, H),
    g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, W, H);
  const rgba = g.getImageData(0, 0, W, H).data,
    gray = new Uint8Array(W * H);
  for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114) | 0;
  return { gray, W, H, res: wm / W };
}

let worker = null;

/**
 * method: 'model' (downloads the model the first time) or 'quick'.
 * onProgress(text) reports what's happening.
 */
export async function detect(u, { method = 'model', hollow = false, onProgress = () => {} } = {}) {
  let files;
  if (method === 'model') files = await modelFiles((f) => onProgress(`Downloading the wall model… ${Math.round(f * 100)}%`));
  onProgress('Reading the image…');
  const { gray, W, H, res } = await grayscale(u);
  worker ??= new Worker(new URL('./detect.worker.js', import.meta.url), { type: 'module' });
  const result = await new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') onProgress(e.data.text);
      else if (e.data.type === 'done') resolve(e.data.result);
      else reject(new Error(e.data.message));
    };
    worker.onerror = (e) => {
      worker = null;
      reject(new Error(e.message || 'Detection stopped unexpectedly. Try again.'));
    };
    // The runtime and model buffers are copied, not transferred, so the cached copies stay usable.
    worker.postMessage({ gray, W, H, res, method, hollow, files }, [gray.buffer]);
  });
  return toPlan(result, u, W * res, H * res);
}
