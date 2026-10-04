// The wall model and the ONNX runtime it needs, downloaded once and kept on this device
// in the browser's Cache Storage so detection works offline afterwards.

import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

const CACHE = 'bydh-models-v1';
export const MODEL = {
  name: 'Wall model v1',
  files: { model: new URL('models/wallnet-v1.onnx', document.baseURI).href, wasm: new URL(wasmUrl, document.baseURI).href },
  approxMB: 19,
};

const hasCache = () => typeof caches !== 'undefined';

/** True when every file is already on this device. */
export async function modelReady() {
  if (!hasCache()) return false;
  const c = await caches.open(CACHE);
  for (const url of Object.values(MODEL.files)) if (!(await c.match(url))) return false;
  return true;
}

/** Download the files into the cache. `onProgress(fraction)` is called as bytes arrive. */
export async function downloadModel(onProgress = () => {}) {
  if (!hasCache()) throw new Error('This browser can’t store the model. Open the app over https, or use the Quick method.');
  const c = await caches.open(CACHE),
    urls = Object.values(MODEL.files);
  const sizes = await Promise.all(urls.map(async (u) => +(await fetch(u, { method: 'HEAD' })).headers.get('content-length') || 0));
  const total = sizes.reduce((a, b) => a + b, 0) || MODEL.approxMB * 1e6;
  let done = 0;
  for (const url of urls) {
    if (await c.match(url)) {
      done += sizes[urls.indexOf(url)];
      onProgress(done / total);
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`The model couldn’t be downloaded (${res.status}). Check your connection and try again.`);
    const reader = res.body.getReader(),
      parts = [];
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      parts.push(value);
      done += value.length;
      onProgress(Math.min(1, done / total));
    }
    await c.put(url, new Response(new Blob(parts), { headers: { 'content-type': res.headers.get('content-type') || 'application/octet-stream' } }));
  }
  onProgress(1);
}

/** Remove the downloaded files from this device. */
export async function deleteModel() {
  if (hasCache()) await caches.delete(CACHE);
}

/** The model and runtime as ArrayBuffers, from the cache (downloading first if needed). */
export async function modelFiles(onProgress) {
  if (!(await modelReady())) await downloadModel(onProgress);
  const c = await caches.open(CACHE);
  const [model, wasm] = await Promise.all([MODEL.files.model, MODEL.files.wasm].map(async (u) => (await c.match(u)).arrayBuffer()));
  return { model, wasm };
}
