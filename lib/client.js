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
