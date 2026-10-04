// Score the whole detection pipeline on held-out generated plans.
//   node tools/wallnet/eval.mjs tools/wallnet/runs/eval
// For each plan, runs wall tracing on (a) the model's mask, (b) the Quick mask, (c) the true mask,
// and reports how many true rooms are found (IoU ≥ 0.8) and how many found rooms are real.

import fs from 'node:fs';
import { quickMask } from '../../src/detect/mask.js';
import { vectorize } from '../../src/detect/vectorize.js';

// Minimal PNG decoding for 8-bit greyscale files written by OpenCV.
import zlib from 'node:zlib';
export function readGray(file) {
  const b = fs.readFileSync(file);
  let p = 8,
    W = 0,
    H = 0,
    ct = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p),
      type = b.toString('ascii', p + 4, p + 8),
      data = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      W = data.readUInt32BE(0);
      H = data.readUInt32BE(4);
      ct = data[9];
    }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  if (ct !== 0) throw new Error(`${file}: expected greyscale PNG`);
  const raw = zlib.inflateSync(Buffer.concat(idat)),
    out = new Uint8Array(W * H);
  let prev = new Uint8Array(W);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (W + 1)],
      row = raw.subarray(y * (W + 1) + 1, (y + 1) * (W + 1)),
      cur = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      const a = x ? cur[x - 1] : 0,
        up = prev[x],
        c = x ? prev[x - 1] : 0;
      let v = row[x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const pp = a + up - c,
          pa = Math.abs(pp - a),
          pb = Math.abs(pp - up),
          pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      cur[x] = v & 255;
    }
    out.set(cur, y * W);
    prev = cur;
  }
  return { W, H, g: out };
}

const iou = (a, b) => {
  const ix = Math.max(0, Math.min(a.x + a.w, b[0] + b[2]) - Math.max(a.x, b[0])),
    iy = Math.max(0, Math.min(a.y + a.h, b[1] + b[3]) - Math.max(a.y, b[1]));
  const i = ix * iy;
  return i / (a.w * a.h + b[2] * b[3] - i);
};

if (import.meta.url === `file://${process.argv[1]}`) main();

function main() {
  const dir = process.argv[2] || 'tools/wallnet/runs/eval';
  const truth = JSON.parse(fs.readFileSync(`${dir}/truth.json`, 'utf8'));
  const totals = {};
  for (const t of truth) {
    const img = readGray(`${dir}/${t.id}_img.png`);
    const masks = {
      model: readGray(`${dir}/${t.id}_model.png`).g.map((v) => (v > 127 ? 1 : 0)),
      quick: quickMask(img.g, img.W, img.H, t.res),
      quickHollow: quickMask(img.g, img.W, img.H, t.res, { hollow: true }),
      truth: readGray(`${dir}/${t.id}_truth.png`).g.map((v) => (v > 127 ? 1 : 0)),
    };
    for (const [k, m] of Object.entries(masks)) {
      const r = vectorize(m, img.W, img.H, t.res, { gray: img.g });
      const found = t.rooms.filter((g) => r.rooms.some((q) => iou(q, g) >= 0.8)).length;
      const real = r.rooms.filter((q) => t.rooms.some((g) => iou(q, g) >= 0.8)).length;
      const s = (totals[k] ??= { rooms: 0, found: 0, detected: 0, real: 0, walls: 0, openings: 0, trueOpenings: 0, perfect: 0 });
      s.rooms += t.rooms.length;
      s.found += found;
      s.detected += r.rooms.length;
      s.real += real;
      s.walls += r.walls.length;
      s.openings += r.openings.length;
      s.trueOpenings += t.doors + t.windows;
      if (found === t.rooms.length && real === r.rooms.length) s.perfect++;
    }
  }
  const pct = (a, b) => `${((100 * a) / Math.max(1, b)).toFixed(0)}%`;
  console.log(`${truth.length} held-out plans`);
  console.log('mask         rooms found   found rooms real   plans fully right   openings found/true');
  for (const [k, s] of Object.entries(totals)) {
    console.log(
      `${k.padEnd(12)} ${pct(s.found, s.rooms).padStart(11)}   ${pct(s.real, s.detected).padStart(16)}   ${pct(s.perfect, truth.length).padStart(17)}   ${s.openings}/${s.trueOpenings}`,
    );
  }
}
