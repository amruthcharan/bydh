// Wall masks from a greyscale drawing, without a model.
// Works best on drawings with solid (filled) walls. Thin lines such as text, dimensions,
// door arcs and furniture are removed by a morphological opening.

/** Otsu's threshold for a greyscale image (0–255). */
export function otsu(gray) {
  const hist = new Float64Array(256);
  for (const v of gray) hist[v]++;
  const n = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0,
    wB = 0,
    best = 0,
    t = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB,
      mF = (sum - sumB) / wF,
      between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      t = i;
    }
  }
  return t;
}

/** Square min (erode) or max (dilate) filter of radius r, done as two 1-D passes. */
function filter(src, W, H, r, max) {
  if (r <= 0) return src.slice();
  const tmp = new Uint8Array(W * H),
    out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = max ? 0 : 1;
      for (let k = Math.max(0, x - r), e = Math.min(W - 1, x + r); k <= e; k++) {
        const p = src[y * W + k];
        if (max ? p : !p) {
          v = max ? 1 : 0;
          break;
        }
      }
      tmp[y * W + x] = v;
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      let v = max ? 0 : 1;
      for (let k = Math.max(0, y - r), e = Math.min(H - 1, y + r); k <= e; k++) {
        const p = tmp[k * W + x];
        if (max ? p : !p) {
          v = max ? 1 : 0;
          break;
        }
      }
      out[y * W + x] = v;
    }
  }
  return out;
}
export const erode = (m, W, H, r) => filter(m, W, H, r, false);
export const dilate = (m, W, H, r) => filter(m, W, H, r, true);

/** Remove connected blobs that are too small, or too compact, to be walls. */
export function dropBlobs(mask, W, H, minPx, minSpanPx) {
  const out = mask.slice(),
    seen = new Uint8Array(W * H),
    st = [],
    blob = [];
  for (let s = 0; s < W * H; s++) {
    if (!out[s] || seen[s]) continue;
    st.push(s);
    seen[s] = 1;
    blob.length = 0;
    let x0 = W,
      x1 = 0,
      y0 = H,
      y1 = 0;
    while (st.length) {
      const c = st.pop(),
        x = c % W,
        y = (c / W) | 0;
      blob.push(c);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const n of [x > 0 && c - 1, x < W - 1 && c + 1, y > 0 && c - W, y < H - 1 && c + W]) {
        if (n !== false && out[n] && !seen[n]) {
          seen[n] = 1;
          st.push(n);
        }
      }
    }
    if (blob.length < minPx || Math.max(x1 - x0, y1 - y0) < minSpanPx) for (const c of blob) out[c] = 0;
  }
  return out;
}

/**
 * Greyscale (0–255, W × H, `res` metres per pixel) → wall mask (1 = wall).
 * `hollow`: walls are drawn as two parallel lines; close the gap between them first.
 */
export function quickMask(gray, W, H, res, { hollow = false } = {}) {
  const t = Math.min(otsu(gray), 200);
  let m = new Uint8Array(W * H);
  for (let i = 0; i < m.length; i++) m[i] = gray[i] <= t ? 1 : 0;
  if (hollow) {
    const r = Math.max(1, Math.round(0.13 / res));
    m = erode(dilate(m, W, H, r), W, H, r);
  }
  const ro = Math.max(1, Math.round(0.035 / res));
  m = dilate(erode(m, W, H, ro), W, H, ro);
  return dropBlobs(m, W, H, Math.round(0.2 / (res * res)), Math.round(0.6 / res));
}
