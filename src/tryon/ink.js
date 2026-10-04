// Превращает любую картинку (фото эскиза на бумаге, PNG с прозрачностью, SVG)
// в «чернила на белом»: белое при умножении на кожу исчезает, тёмное — ложится в кожу.

const MAX = 1024;
const INK = [22, 21, 27];
const HEALED_INK = [38, 46, 52]; // чёрный пигмент со временем уходит в сине-зелёный

export async function loadImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  return img;
}

// Нормализуем фон: самый светлый (бумага) → белый, самый тёмный → чернила.
function normalize(img, { mono, threshold }) {
  const w0 = img.naturalWidth || img.width || MAX;
  const h0 = img.naturalHeight || img.height || MAX;
  const k = Math.min(1, MAX / Math.max(w0, h0)) || 1;
  // небольшое поле вокруг рисунка, чтобы размытие не упиралось в край
  const pad = 0.06;
  const w = Math.round(w0 * k);
  const h = Math.round(h0 * k);
  const W = Math.round(w * (1 + pad * 2));
  const H = Math.round(h * (1 + pad * 2));

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, Math.round(w * pad), Math.round(h * pad), w, h);

  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  // гистограмма только по самой картинке — белые поля не должны считаться «бумагой»
  const hist = new Uint32Array(256);
  const x0 = Math.round(w * pad);
  const y0 = Math.round(h * pad);
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 4;
      hist[(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0]++;
    }
  }
  const total = w * h;
  const pct = (p) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= total * p) return v;
    return 255;
  };
  const white = Math.max(pct(0.9), 60);
  const black = Math.min(pct(0.005), white - 40);
  const span = white - black;
  const lo = threshold - 0.12;

  for (let i = 0; i < px.length; i += 4) {
    let r = (px[i] - black) / span;
    let g = (px[i + 1] - black) / span;
    let b = (px[i + 2] - black) / span;
    const L = Math.min(1, Math.max(0, r * 0.299 + g * 0.587 + b * 0.114));
    // мягкий порог: всё светлее порога превращается в «чистую кожу»
    const keep = L >= threshold ? 0 : L <= lo ? 1 : (threshold - L) / (threshold - lo);
    if (mono) r = g = b = L;
    const ink = (v, n) => {
      const t = Math.min(1, Math.max(0, v));
      const val = n * (1 - t) + 255 * t; // чернила → белый
      return 255 - (255 - val) * keep;
    };
    if (mono) {
      px[i] = ink(r, INK[0]);
      px[i + 1] = ink(g, INK[1]);
      px[i + 2] = ink(b, INK[2]);
    } else {
      px[i] = 255 - (255 - Math.min(255, Math.max(0, r * 255))) * keep;
      px[i + 1] = 255 - (255 - Math.min(255, Math.max(0, g * 255))) * keep;
      px[i + 2] = 255 - (255 - Math.min(255, Math.max(0, b * 255))) * keep;
    }
    px[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

function tint(src, rgb, strength) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const a = (1 - (px[i] + px[i + 1] + px[i + 2]) / 765) * strength;
    px[i] = px[i] * (1 - a) + rgb[0] * a;
    px[i + 1] = px[i + 1] * (1 - a) + rgb[1] * a;
    px[i + 2] = px[i + 2] * (1 - a) + rgb[2] * a;
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

/**
 * @param {HTMLImageElement} img
 * @param {{mono?: boolean, state?: 'fresh'|'healed', threshold?: number}} opts
 * @returns {HTMLCanvasElement} квадратный холст «чернила на белом»
 */
export function inkify(img, { mono = false, state = 'healed', threshold = 0.82 } = {}) {
  let base = normalize(img, { mono, threshold });
  const unit = Math.max(base.width, base.height) / MAX;

  const out = document.createElement('canvas');
  // квадрат, чтобы пропорции декали задавались только размером
  const S = Math.max(base.width, base.height);
  out.width = out.height = S;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, S, S);
  const ox = (S - base.width) / 2;
  const oy = (S - base.height) / 2;

  if (state === 'fresh') {
    // покраснение вокруг линий
    const halo = tint(base, [226, 120, 100], 1);
    ctx.globalCompositeOperation = 'multiply';
    ctx.filter = `blur(${(14 * unit).toFixed(1)}px)`;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(halo, ox, oy);
    ctx.globalAlpha = 1;
    ctx.filter = `blur(${(0.4 * unit).toFixed(2)}px)`;
    ctx.drawImage(base, ox, oy);
  } else {
    if (mono) base = tint(base, HEALED_INK, 0.35);
    ctx.globalCompositeOperation = 'multiply';
    ctx.filter = `blur(${(1.6 * unit).toFixed(2)}px)`;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(base, ox, oy);
  }
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return out;
}
