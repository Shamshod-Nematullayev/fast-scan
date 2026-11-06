// QR kodni asosiy oqimni (va taymer animatsiyasini) to'xtatmasdan o'qish uchun worker.
importScripts("/vendor/jsQR.js");

self.onmessage = async (event) => {
  const { id, url } = event.data;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Rasm topilmadi");
    const bitmap = await createImageBitmap(await res.blob());
    const data = findQR(bitmap);
    bitmap.close();
    self.postMessage({ id, data });
  } catch (err) {
    self.postMessage({ id, data: null, error: String(err) });
  }
};

// Skaner qilingan varaq katta bo'ladi. Avval kichraytirilgan butun varaqni,
// keyin to'liq o'lchamda pastki (QR odatda pastda) va yuqori yarmini tekshiramiz.
function findQR(bitmap) {
  const W = bitmap.width;
  const H = bitmap.height;
  const fit = Math.min(1, 1400 / Math.max(W, H));
  const attempts = [
    { scale: fit, region: [0, 0, 1, 1] },
    { scale: 1, region: [0, 0.45, 1, 1] },
    { scale: 1, region: [0, 0, 1, 0.55] },
    { scale: Math.min(1, fit * 1.5), region: [0, 0, 1, 1] },
  ];

  for (const { scale, region } of attempts) {
    const [x0, y0, x1, y1] = region;
    const sx = Math.round(x0 * W);
    const sy = Math.round(y0 * H);
    const sw = Math.round((x1 - x0) * W);
    const sh = Math.round((y1 - y0) * H);
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    const code = self.jsQR(image.data, w, h, { inversionAttempts: "dontInvert" });
    if (code && code.data) return code.data;
  }
  return null;
}
