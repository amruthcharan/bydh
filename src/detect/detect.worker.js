// Runs wall detection off the main thread.
// In:  { gray, W, H, res, method: 'model' | 'quick', hollow, files?: { model, wasm } }
// Out: { type: 'progress', text } … then { type: 'done', result } or { type: 'error', message }

import { quickMask } from './mask.js';
import { vectorize } from './vectorize.js';

const TILE = 512,
  OVERLAP = 32;
let session = null,
  ort = null;

async function modelMask(gray, W, H, files) {
  if (!session) {
    ort = await import('onnxruntime-web/wasm');
    ort.env.wasm.wasmBinary = files.wasm;
    ort.env.wasm.numThreads = 1;
    session = await ort.InferenceSession.create(files.model, { executionProviders: ['wasm'] });
  }
  // Run in overlapping tiles so memory stays small, keeping each tile's centre.
  const mask = new Uint8Array(W * H),
    step = TILE - 2 * OVERLAP;
  const tiles = Math.ceil(W / step) * Math.ceil(H / step);
  let n = 0;
  for (let ty = 0; ty < H; ty += step) {
    for (let tx = 0; tx < W; tx += step) {
      const x0 = Math.max(0, tx - OVERLAP),
        y0 = Math.max(0, ty - OVERLAP);
      const tw = Math.min(TILE, W - x0),
        th = Math.min(TILE, H - y0);
      const pw = Math.ceil(tw / 16) * 16,
        ph = Math.ceil(th / 16) * 16;
      const input = new Float32Array(pw * ph).fill(1);
      for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) input[y * pw + x] = gray[(y0 + y) * W + x0 + x] / 255;
      const out = await session.run({ image: new ort.Tensor('float32', input, [1, 1, ph, pw]) });
      const logits = out.logits.data;
      for (let y = ty; y < Math.min(H, ty + step); y++) {
        for (let x = tx; x < Math.min(W, tx + step); x++) mask[y * W + x] = logits[(y - y0) * pw + (x - x0)] > 0 ? 1 : 0;
      }
      self.postMessage({ type: 'progress', text: `Finding walls… ${Math.round((++n / tiles) * 100)}%` });
    }
  }
  return mask;
}

self.onmessage = async (e) => {
  const { gray, W, H, res, method, hollow, files } = e.data;
  try {
    self.postMessage({ type: 'progress', text: 'Finding walls…' });
    const mask = method === 'model' ? await modelMask(gray, W, H, files) : quickMask(gray, W, H, res, { hollow });
    self.postMessage({ type: 'progress', text: 'Tracing walls and rooms…' });
    self.postMessage({ type: 'done', result: vectorize(mask, W, H, res, { gray }) });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
