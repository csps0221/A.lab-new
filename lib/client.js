export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '請求失敗');
  return data;
}

// 裁切並壓縮成 JPEG base64(最長邊 1024、品質 0.72),避免超過 Vercel 4.5MB 請求上限
export function cropToB64(img, c, max = 1024, q = 0.72) {
  const sx = img.naturalWidth / img.width;
  const sy = img.naturalHeight / img.height;
  const has = c && c.width > 4 && c.height > 4;
  const x = has ? c.x * sx : 0;
  const y = has ? c.y * sy : 0;
  const w = has ? c.width * sx : img.naturalWidth;
  const h = has ? c.height * sy : img.naturalHeight;
  const k = Math.min(1, max / Math.max(w, h));
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * k);
  cv.height = Math.round(h * k);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, x, y, w, h, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', q).split(',')[1];
}

// 把相機或相簿的檔案縮成 JPEG base64(最長邊 1280、品質 0.75),避免超過 Vercel 4.5MB 請求上限
export async function fileToB64(file, max = 1280, q = 0.75) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('無法讀取這張圖片,請換 JPG 或 PNG 試試'));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * k);
    cv.height = Math.round(img.naturalHeight * k);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', q).split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 讀取 PDF 檔成 base64(Vercel 單次請求上限約 4.5MB,所以 PDF 以 3MB 為限)
export const PDF_MAX = 3 * 1024 * 1024;
export function pdfToB64(file) {
  return new Promise((res, rej) => {
    if (file.size > PDF_MAX) return rej(new Error('PDF 太大了(上限 3 MB),請壓縮或分成幾個檔案上傳'));
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(new Error('無法讀取這個檔案'));
    r.readAsDataURL(file);
  });
}

// 載入 pdf.js(從 CDN,用到才載入),在瀏覽器裡把 PDF 的指定頁面/區塊截成圖片
let pdfjsPromise = null;
export function loadPdfJs() {
  if (typeof window === 'undefined') return Promise.reject(new Error('只能在瀏覽器使用'));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsPromise) {
    pdfjsPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        res(window.pdfjsLib);
      };
      s.onerror = () => { pdfjsPromise = null; rej(new Error('無法載入 PDF 讀取工具,請確認網路連線')); };
      document.head.appendChild(s);
    });
  }
  return pdfjsPromise;
}

// jobs: [{ key, page, box:[上緣,下緣](0~1000) | null }] → { key: JPEG base64 }
export async function renderPdfFigures(file, jobs) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = {};
  const out = {};
  for (const j of jobs) {
    const pn = Math.min(Math.max(1, j.page), doc.numPages);
    if (!pages[pn]) {
      const page = await doc.getPage(pn);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(2, 1100 / base.width) });
      const cv = document.createElement('canvas');
      cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      pages[pn] = cv;
    }
    const src = pages[pn];
    let y0 = 0, y1 = src.height;
    if (j.box) {
      y0 = Math.max(0, Math.floor(src.height * (j.box[0] / 1000) - src.height * 0.012));
      y1 = Math.min(src.height, Math.ceil(src.height * (j.box[1] / 1000) + src.height * 0.012));
    }
    const h = Math.max(1, y1 - y0);
    const cv2 = document.createElement('canvas');
    cv2.width = src.width; cv2.height = h;
    cv2.getContext('2d').drawImage(src, 0, y0, src.width, h, 0, 0, src.width, h);
    out[j.key] = cv2.toDataURL('image/jpeg', 0.72).split(',')[1];
  }
  return out;
}
