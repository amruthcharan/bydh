// Turn an uploaded image or PDF page into a data URL the plan can trace over.
const MAX_SIDE = 3200;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This image could not be read. Try a PNG or JPG.'));
    img.src = src;
  });
}

function toDataURL(source, w, h) {
  const s = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(source, 0, 0, c.width, c.height);
  return { src: c.toDataURL('image/jpeg', 0.88), w: c.width, h: c.height };
}

export async function imageFileToUnderlay(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return toDataURL(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

let pdfjsPromise;
async function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
}

/** Open a PDF and return { pageCount, render(pageNumber) }. */
export async function openPdf(file) {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await lib.getDocument({ data }).promise;
  return {
    pageCount: doc.numPages,
    async render(pageNo) {
      const page = await doc.getPage(pageNo);
      const vp1 = page.getViewport({ scale: 1 });
      const scale = Math.min(3, MAX_SIDE / Math.max(vp1.width, vp1.height));
      const vp = page.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvas: c, canvasContext: g, viewport: vp }).promise;
      return { src: c.toDataURL('image/jpeg', 0.88), w: c.width, h: c.height };
    },
  };
}

export const isPdf = (file) => file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
