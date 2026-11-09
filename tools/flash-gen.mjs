// Рисует демо-эскизы флеш-листа в src/data/flash/*.svg.
// Всё нарисовано кодом с нуля (никаких чужих картинок), мотивы — по трендам 2025–2026:
// fine line + dotwork, cyber sigilism, орнамент на грудину, coquette-бант, морской мотив,
// нео-традишнл с красным. Запуск: node tools/flash-gen.mjs
// __PAPER__ — «пустоты» внутри рисунка (на сайте цвет бумаги, в примерочной белый).
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../src/data/flash/', import.meta.url);
const INK = '#16151B';
const RED = '#D23A1E';
const P = '__PAPER__';

// ——— геометрия ———
const f = (n) => String(Math.round(n * 10) / 10);
const pt = ([x, y]) => `${f(x)} ${f(y)}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const rot = (a, r) => [a[0] * Math.cos(r) - a[1] * Math.sin(r), a[0] * Math.sin(r) + a[1] * Math.cos(r)];
const pol = (c, r, a) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
const lerp = (a, b, t) => a + (b - a) * t;
const D = Math.PI / 180;

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cubic = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
};

// SVG-путь (только абсолютные M L C Q Z) → ломаная
function poly(d, n = 18) {
  const tok = d.match(/[MLCQZ]|-?\d*\.?\d+/g);
  const pts = [];
  let i = 0;
  let cmd = 'M';
  let cur = [0, 0];
  const num = () => +tok[i++];
  const P2 = () => [num(), num()];
  while (i < tok.length) {
    if (/[MLCQZ]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'Z') continue;
    if (cmd === 'M') {
      cur = P2();
      pts.push(cur);
      cmd = 'L';
    } else if (cmd === 'L') {
      cur = P2();
      pts.push(cur);
    } else if (cmd === 'C') {
      const a = P2();
      const b = P2();
      const c = P2();
      for (let k = 1; k <= n; k++) pts.push(cubic(cur, a, b, c, k / n));
      cur = c;
    } else if (cmd === 'Q') {
      const a = P2();
      const c = P2();
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const u = 1 - t;
        pts.push([0, 1].map((j) => u * u * cur[j] + 2 * u * t * a[j] + t * t * c[j]));
      }
      cur = c;
    }
  }
  return pts;
}

const lengths = (pts) => {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + len(sub(pts[i], pts[i - 1])));
  return L;
};
const tangent = (pts, i) => norm(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]));
const line = (pts) => 'M' + pts.map(pt).join('L');
const closed = (pts) => line(pts) + 'Z';

// лента переменной ширины вдоль ломаной: w(t) — половина ширины, t ∈ [0,1]
function ribbon(pts, w) {
  const L = lengths(pts);
  const T = L[L.length - 1];
  const left = [];
  const right = [];
  pts.forEach((p, i) => {
    const [tx, ty] = tangent(pts, i);
    const h = w(L[i] / T, L[i]);
    left.push([p[0] - ty * h, p[1] + tx * h]);
    right.push([p[0] + ty * h, p[1] - tx * h]);
  });
  return { d: closed([...left, ...right.reverse()]), left, right: right.reverse() };
}
// профили толщины
const pointed = (w, k = 0.7) => (t) => w * Math.sin(Math.PI * t) ** k + 0.05; // острые оба конца
const blade = (w, k = 0.9) => (t) => w * (1 - t) ** k * Math.min(1, 0.35 + t * 6) + 0.05; // толстый старт, острый конец

const inside = (poly, [x, y]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

// точки dotwork: плотность density(p) ∈ [0,1], минимальное расстояние gap
function stipple(area, tries, density, seed, gap = 1.6) {
  const rand = rng(seed);
  const xs = area.map((p) => p[0]);
  const ys = area.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const out = [];
  const grid = new Map();
  const key = (x, y) => `${Math.floor(x / gap)},${Math.floor(y / gap)}`;
  for (let k = 0; k < tries; k++) {
    const p = [lerp(x0, x1, rand()), lerp(y0, y1, rand())];
    if (!inside(area, p) || rand() > density(p)) continue;
    let ok = true;
    const gx = Math.floor(p[0] / gap);
    const gy = Math.floor(p[1] / gap);
    for (let a = -1; a <= 1 && ok; a++)
      for (let b = -1; b <= 1 && ok; b++) {
        const q = grid.get(`${gx + a},${gy + b}`);
        if (q && len(sub(q, p)) < gap) ok = false;
      }
    if (!ok) continue;
    grid.set(key(...p), p);
    out.push(p);
  }
  return out;
}
const dots = (pts, size = 1.1, color = INK) =>
  pts.length ? `<path class="dots" d="${pts.map((p) => `M${pt(p)}h.01`).join('')}" stroke="${color}" stroke-width="${size}"/>` : '';

const fillPath = (d, color = INK) => `<path class="fill" d="${d}" fill="${color}" stroke="none"/>`;
const sparkle = ([x, y], r, color = INK) =>
  fillPath(`M${f(x)} ${f(y - r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y + r)}Q${f(x)} ${f(y)} ${f(x - r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y - r)}Z`, color);
// масштаб относительно центра фигуры (для внутреннего контура)
const shrink = (pts, k) => {
  const c = mul(pts.reduce(add, [0, 0]), 1 / pts.length);
  return pts.map((p) => add(c, mul(sub(p, c), k)));
};
// зеркальная половина
const mirror = (id, body) => `<g id="${id}">${body}</g><use href="#${id}" transform="matrix(-1 0 0 1 200 0)"/>`;

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 200 200" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;

// ═══════════ 1. Місячний метелик (luna moth): fine line + dotwork ═══════════
function luna() {
  const FW = 'M97 80 C84 60 54 38 20 30 C22 52 28 80 44 98 C60 105 82 101 97 92 Z';
  const HW = 'M98 96 C80 96 54 102 47 122 C42 138 56 150 70 152 C77 163 74 178 63 191 C73 193 82 186 84 175 C87 158 92 128 98 108 Z';
  const fw = poly(FW);
  const hw = poly(HW);
  const base = [97, 88];
  const fwDots = stipple(fw, 6000, (p) => 0.95 * Math.exp(-((len(sub(p, base)) / 30) ** 1.8)) + 0.5 * Math.exp(-((len(sub(p, [24, 32])) / 10) ** 2)), 11);
  const hwDots = stipple(hw, 5000, (p) => 0.95 * Math.exp(-((len(sub(p, [97, 104])) / 26) ** 1.8)) + 0.7 * Math.exp(-((len(sub(p, [66, 186])) / 8) ** 2)), 12);
  const veins = [
    'M95 84 Q70 70 30 52', 'M95 86 Q70 80 36 74', 'M95 88 Q72 90 46 94', 'M96 90 Q84 96 70 101',
    'M96 100 Q74 104 52 116', 'M96 102 Q74 116 50 138', 'M96 104 Q82 124 66 148', 'M97 106 Q88 140 74 166',
  ];
  // перистые усики
  const ant = poly('M98.5 71 C96 58 88 47 74 39', 30);
  const AL = lengths(ant);
  let barbs = '';
  ant.forEach((p, i) => {
    const t = AL[i] / AL[AL.length - 1];
    if (t < 0.1 || t > 0.97 || i % 1) return;
    const tg = tangent(ant, i);
    const l = 0.8 + 4.2 * Math.sin(Math.PI * t) ** 0.8;
    for (const s of [-1, 1]) barbs += `M${pt(p)}L${pt(add(p, mul(rot(tg, s * 52 * D), l)))}`;
  });
  const eye = (c, rx, ry, a) => `
    <ellipse cx="${c[0]}" cy="${c[1]}" rx="${rx}" ry="${ry}" transform="rotate(${a} ${c[0]} ${c[1]})" fill="${P}" stroke-width="1.3"/>
    <ellipse cx="${c[0]}" cy="${c[1]}" rx="${rx - 2.4}" ry="${ry - 2.4}" transform="rotate(${a} ${c[0]} ${c[1]})" stroke-width="0.7"/>
    <path class="fill" d="M${c[0] - rx * 0.5} ${c[1] - ry * 0.45}Q${c[0] + rx * 0.55} ${c[1]} ${c[0] - rx * 0.5} ${c[1] + ry * 0.45}Q${c[0] - rx * 0.05} ${c[1]} ${c[0] - rx * 0.5} ${c[1] - ry * 0.45}Z" transform="rotate(${a} ${c[0]} ${c[1]})" fill="${INK}" stroke="none"/>`;
  const half = `
    ${dots(fwDots, 1.05)}${dots(hwDots, 1.05)}
    <path d="${veins.join('')}" stroke-width="0.75"/>
    <path d="${HW}" stroke-width="1.5"/>
    <path d="${closed(shrink(hw, 0.86))}" stroke-width="0.9" stroke-dasharray="0.1 2.6"/>
    <path d="${FW}" stroke-width="1.5"/>
    <path d="${closed(shrink(fw, 0.86))}" stroke-width="0.9" stroke-dasharray="0.1 2.6"/>
    ${fillPath(ribbon(poly('M97 80 C84 60 54 38 20 30'), (t) => 2.2 * (1 - t) + 0.4).d)}
    ${eye([60, 70], 7.5, 9.5, -28)}${eye([64, 126], 5.8, 7, 18)}
    <path d="M98.5 71 C96 58 88 47 74 39" stroke-width="0.9"/><path d="${barbs}" stroke-width="0.55"/>`;
  const thorax = poly('M100 76 C107 77 108 88 105 96 C103 99 97 99 95 96 C92 88 93 77 100 76 Z');
  const hair = stipple(thorax, 1500, () => 0.8, 13, 1.25);
  const segs = [104, 110, 116, 122, 128, 134].map((y) => `M95.6 ${y}Q100 ${y + 2.4} 104.4 ${y}`).join('');
  return svg(`
    ${mirror('luna-h', half)}
    <path d="${closed(thorax)}" fill="${P}" stroke-width="1.3"/>${dots(hair, 1.15)}
    <path d="M100 97 C106 99 107 116 104.5 132 C103.5 139 101.5 143 100 143 C98.5 143 96.5 139 95.5 132 C93 116 94 99 100 97 Z" fill="${P}" stroke-width="1.3"/>
    <path d="${segs}" stroke-width="0.8"/>
    <circle class="fill" cx="100" cy="73" r="4.2" fill="${INK}" stroke="none"/>
    ${fillPath('M101 9 A10 10 0 1 0 101 29 A12.5 12.5 0 0 1 101 9 Z')}
    ${sparkle([118, 14], 4)}${sparkle([84, 24], 2.6)}${sparkle([124, 30], 2)}
  `);
}

// ═══════════ 2. Кібер-сигіл (cyber sigilism) ═══════════
function sigil() {
  const prof = { blade, pointed, flame: (w) => (t) => w * Math.sin(Math.PI * t ** 0.55) ** 0.8 + 0.05 };
  const strokes = [
    // путь, толщина, профиль, шипы [t, длина, сторона]
    ['M99 44 C95 30 92 18 85 3', 1.7, 'blade', [[0.5, 6, 1]]],
    ['M98 54 C86 48 75 36 73 20 C72 11 77 6 82 8', 1.9, 'blade', [[0.35, 7, 1]]],
    ['M97 68 C80 68 60 60 50 42 C44 31 46 19 55 12', 2.2, 'blade', [[0.28, 8, -1], [0.55, 7, 1], [0.8, 5, -1]]],
    ['M97 86 C78 86 56 82 41 93 C29 102 26 120 33 134 C37 141 44 143 49 140', 2.4, 'blade', [[0.2, 9, 1], [0.42, 8, -1], [0.66, 7, -1], [0.85, 5, 1]]],
    ['M89 97 C75 101 63 111 59 127', 1.5, 'pointed', []],
    ['M97 110 C86 118 75 126 73 143 C71 159 83 169 79 187', 2.2, 'blade', [[0.28, 8, -1], [0.6, 7, 1]]],
    ['M98 130 C94 144 91 162 93 197', 1.4, 'blade', [[0.45, 6, -1]]],
    ['M31 58 C22 73 22 88 31 101', 1.5, 'flame', []],
    ['M55 152 C46 163 46 176 54 190', 1.3, 'flame', []],
    ['M60 22 C64 30 64 38 60 46', 1, 'pointed', []],
    ['M99 77 C94 75 90 71 88 64', 1.1, 'blade', []],
    ['M99 120 C95 124 92 128 91 134', 1.1, 'blade', []],
  ];
  let body = '';
  for (const [d, w, kind, barbs] of strokes) {
    const pts = poly(d, 30);
    body += fillPath(ribbon(pts, prof[kind](w)).d);
    const L = lengths(pts);
    for (const [t, l, side] of barbs) {
      const i = L.findIndex((x) => x >= t * L[L.length - 1]);
      const p = pts[i];
      const tg = tangent(pts, i);
      const nrm = mul([-tg[1], tg[0]], side);
      const dir = norm(add(nrm, mul(tg, 1.1)));
      const end = add(p, mul(dir, l));
      const ctrl = add(p, add(mul(dir, l * 0.5), mul(nrm, l * 0.3)));
      body += fillPath(ribbon(poly(`M${pt(p)} Q${pt(ctrl)} ${pt(end)}`, 14), blade(w * 0.5 * (1 - t * 0.5))).d);
    }
  }
  // тонкие «хромовые» параллели
  for (const [d, off, a, b] of [
    ['M97 86 C78 86 56 82 41 93 C29 102 26 120 33 134 C37 141 44 143 49 140', 4.6, 0.1, 0.72],
    ['M97 68 C80 68 60 60 50 42 C44 31 46 19 55 12', 4.2, 0.12, 0.62],
    ['M97 110 C86 118 75 126 73 143 C71 159 83 169 79 187', -4.2, 0.15, 0.7],
  ]) {
    const pts = poly(d, 30);
    const L = lengths(pts);
    const T = L[L.length - 1];
    const off2 = pts
      .map((p, i) => [p, i])
      .filter(([, i]) => L[i] / T >= a && L[i] / T <= b)
      .map(([p, i]) => {
        const tg = tangent(pts, i);
        return add(p, mul([-tg[1], tg[0]], off));
      });
    body += fillPath(ribbon(off2, pointed(0.5, 0.5)).d);
  }
  const center = `
    ${fillPath(ribbon(poly('M100 1 L100 199', 40), (t) => 0.3 + 1.5 * Math.sin(Math.PI * t) ** 5).d)}
    ${fillPath('M100 76 L105.5 97 L100 120 L94.5 97 Z')}
    <path d="M100 87 L102.6 97 L100 108 L97.4 97 Z" fill="${P}" stroke="none"/>
    <circle cx="100" cy="58" r="3.6" fill="${P}" stroke-width="1.1"/>
    ${fillPath('M100 140 L102.4 147 L100 156 L97.6 147 Z')}
    <circle cx="100" cy="168" r="1.8" fill="${P}" stroke-width="0.9"/>`;
  return svg(`${mirror('sigil-h', `${body}${sparkle([44, 112], 3.2)}${sparkle([68, 48], 2)}${sparkle([28, 176], 2.6)}${sparkle([20, 30], 1.8)}`)}${center}`);
}

// ═══════════ 3. Орнамент на грудину (dotwork, «люстра») ═══════════
function sternum() {
  const C = [100, 64];
  const petal = (r0, r1, a, da, k = 0.45) => {
    const rm = lerp(r0, r1, k);
    const b = pol(C, r0, a);
    const tip = pol(C, r1, a);
    return `M${pt(b)}C${pt(pol(C, rm, a - da))} ${pt(pol(C, lerp(rm, r1, 0.6), a - da * 0.4))} ${pt(tip)}C${pt(pol(C, lerp(rm, r1, 0.6), a + da * 0.4))} ${pt(pol(C, rm, a + da))} ${pt(b)}Z`;
  };
  let m = '';
  // большие лепестки с точечной растушёвкой у основания
  const big = 16;
  const area = [];
  for (let i = 0; i < big; i++) {
    const a = (i / big) * 2 * Math.PI - Math.PI / 2;
    const d = petal(23, 39, a, 0.2, 0.4);
    m += `<path d="${d}" fill="${P}" stroke-width="1.1"/>`;
    area.push(poly(d, 10));
    m += `<path d="M${pt(pol(C, 26, a))}L${pt(pol(C, 33, a))}" stroke-width="0.6"/>`;
  }
  let pd = [];
  area.forEach((a, i) => (pd = pd.concat(stipple(a, 260, (p) => Math.max(0, 1 - (len(sub(p, C)) - 23) / 14) ** 1.3, 40 + i, 1.25))));
  m += dots(pd, 0.95);
  // малые лепестки между большими
  for (let i = 0; i < big; i++) {
    const a = ((i + 0.5) / big) * 2 * Math.PI - Math.PI / 2;
    m += `<path d="${petal(24, 31, a, 0.11)}" stroke-width="0.7"/>`;
    m += `<circle class="fill" cx="${f(pol(C, 43.5, a)[0])}" cy="${f(pol(C, 43.5, a)[1])}" r="1" fill="${INK}" stroke="none"/>`;
  }
  for (let i = 0; i < big; i++) {
    const p = pol(C, 41.5, (i / big) * 2 * Math.PI - Math.PI / 2);
    m += `<circle class="fill" cx="${f(p[0])}" cy="${f(p[1])}" r="1.5" fill="${INK}" stroke="none"/>`;
  }
  m += `<circle cx="100" cy="64" r="21" stroke-width="1.3" stroke-dasharray="0.1 2.3"/>`;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 2 * Math.PI - Math.PI / 2;
    m += `<path d="${petal(7.5, 19, a, 0.34)}" fill="${P}" stroke-width="1.2"/><path d="M${pt(pol(C, 10, a))}L${pt(pol(C, 15.5, a))}" stroke-width="0.6"/>`;
  }
  m += `<circle cx="100" cy="64" r="6.5" fill="${P}" stroke-width="1.1"/><circle class="fill" cx="100" cy="64" r="3.6" fill="${INK}" stroke="none"/>`;

  // подвески
  const drop = (x, y, s, solid) => {
    const d = `M${f(x)} ${f(y)}C${f(x + 4.2 * s)} ${f(y + 5 * s)} ${f(x + 4.6 * s)} ${f(y + 9 * s)} ${f(x)} ${f(y + 11.5 * s)}C${f(x - 4.6 * s)} ${f(y + 9 * s)} ${f(x - 4.2 * s)} ${f(y + 5 * s)} ${f(x)} ${f(y)}Z`;
    return solid ? fillPath(d) : `<path d="${d}" fill="${P}" stroke-width="1.1"/>`;
  };
  let hang = '';
  const strand = (dx, n, endS, solid) => {
    const x = 100 + dx;
    let y = 64 + Math.sqrt(44.5 ** 2 - dx * dx) + 2.5;
    for (let k = 0; k < n; k++) {
      const r = lerp(1.9, 1.05, k / Math.max(1, n - 1));
      hang += `<circle class="fill" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${INK}" stroke="none"/>`;
      y += r * 2 + 1.6;
    }
    hang += drop(x, y - 0.6, endS, solid);
    return y;
  };
  const y0 = strand(0, 12, 1.5, false);
  // центральная капля: ромб + капля с dotwork
  const bigDrop = poly(`M100 ${y0 + 1}C106 ${y0 + 7.5} 106.6 ${y0 + 13} 100 ${y0 + 17}C93.4 ${y0 + 13} 94 ${y0 + 7.5} 100 ${y0 + 1}Z`);
  hang += dots(stipple(bigDrop, 300, (p) => 0.2 + (p[1] - y0) / 20, 77, 1.1), 0.9);
  for (const [dx, n, s] of [[13, 8, 1], [25, 5, 0.8], [35, 3, 0.62]]) {
    strand(dx, n, s, true);
    strand(-dx, n, s, true);
  }
  // боковая филигрань (зеркально): ветвь с листочками и бусы
  const vine = poly('M58 68 C44 74 28 70 10 50', 30);
  const VL = lengths(vine);
  let side = fillPath(ribbon(vine, blade(1.3, 1)).d);
  for (let k = 1; k <= 7; k++) {
    const t = k / 8.2;
    const i = VL.findIndex((x) => x >= t * VL[VL.length - 1]);
    const p = vine[i];
    const tg = tangent(vine, i);
    const s = lerp(8, 3.6, t);
    for (const sd of [-1, 1]) {
      const dir = norm(add(mul([-tg[1], tg[0]], sd), mul(tg, 0.9)));
      const tip = add(p, mul(dir, s));
      const nn = [-dir[1], dir[0]];
      const lp = `M${pt(p)}Q${pt(add(add(p, mul(dir, s * 0.5)), mul(nn, s * 0.32)))} ${pt(tip)}Q${pt(add(add(p, mul(dir, s * 0.5)), mul(nn, -s * 0.32)))} ${pt(p)}Z`;
      side += sd > 0 ? fillPath(lp) : `<path d="${lp}" fill="${P}" stroke-width="0.8"/>`;
    }
  }
  const beads = poly('M60 84 C48 94 30 92 16 78', 60);
  const BL = lengths(beads);
  let at = 0;
  for (let k = 0; k < 11; k++) {
    const t = at / BL[BL.length - 1];
    if (t > 1) break;
    const i = BL.findIndex((x) => x >= at);
    const r = lerp(1.6, 0.8, t);
    side += `<circle class="fill" cx="${f(beads[i][0])}" cy="${f(beads[i][1])}" r="${f(r)}" fill="${INK}" stroke="none"/>`;
    at += r * 2 + 2.2;
  }
  side += sparkle([22, 32], 3.4) + sparkle([44, 120], 2.4) + sparkle([66, 160], 1.8);
  const top = `
    <path d="${petal(44, 54, -Math.PI / 2, 0.09)}" fill="${P}" stroke-width="1.1"/>
    ${[57.5, 61.5, 64.8].map((r, k) => `<circle class="fill" cx="100" cy="${f(64 - r)}" r="${[1.5, 1.15, 0.85][k]}" fill="${INK}" stroke="none"/>`).join('')}`;
  return svg(`${mirror('sternum-h', side)}${m}${hang}${top}`);
}

// ═══════════ 4. Бант і рябчики (coquette + fine line) ═══════════
function bow() {
  // колокольчик рябчика: изогнутая шахматка
  const bell = (top, ang, L, W, seed) => {
    const hwF = (v) => W * Math.sin((Math.min(v, 0.62) / 0.62) * (Math.PI / 2)) ** 0.62 * (1 - 0.12 * Math.max(0, v - 0.62) / 0.38);
    const map = (u, v) => add(top, rot([u * hwF(v), v * L], ang));
    const rows = 7;
    const cols = 6;
    let chk = '';
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        if ((i + j) % 2) continue;
        const [v0, v1] = [lerp(0.1, 0.94, j / rows), lerp(0.1, 0.94, (j + 1) / rows)];
        const [u0, u1] = [lerp(-0.92, 0.92, i / cols), lerp(-0.92, 0.92, (i + 1) / cols)];
        chk += `M${pt(map(u0, v0))}L${pt(map(u1, v0))}L${pt(map(u1, v1))}L${pt(map(u0, v1))}Z`;
      }
    const sideL = [];
    const sideR = [];
    for (let k = 0; k <= 20; k++) {
      const v = k / 20;
      sideL.push(map(-1, v));
      sideR.push(map(1, v));
    }
    const bottom = [map(1, 1), map(0.62, 1.08), map(0.34, 1), map(0, 1.1), map(-0.34, 1), map(-0.62, 1.08), map(-1, 1)];
    const outline = closed([...sideR, ...bottom, ...sideL.reverse()]);
    const ribs = [-0.45, 0, 0.45].map((u) => line([0.05, 0.3, 0.6, 0.9, 1.04].map((v) => map(u, v)))).join('');
    return `<path d="${outline}" fill="${P}" stroke-width="1.2"/>${fillPath(chk)}<path d="${ribs}" stroke-width="0.5" stroke="${P}"/>
      <path d="${outline}" stroke-width="1.2"/>
      ${fillPath(ribbon(poly(`M${pt(top)}L${pt(add(top, rot([0, -5], ang)))}`, 4), () => 1.6).d)}`;
  };
  const leaf = (d, w) => `<path d="${ribbon(poly(d, 26), pointed(w, 0.8)).d}" fill="${P}" stroke-width="1"/><path d="${d}" stroke-width="0.5"/>`;
  const stems = `
    <path d="M97 196 C95 150 84 110 70 84 C64 72 54 68 46 74" stroke-width="1.3"/>
    <path d="M100 196 C101 140 106 92 116 58 C120 46 132 40 140 48" stroke-width="1.3"/>
    <path d="M103 196 C107 162 126 130 150 114 C158 108 168 108 172 118" stroke-width="1.3"/>
    <path d="M99 196 C98 140 90 92 94 50 C95 38 90 30 82 30" stroke-width="1.3"/>
    ${leaf('M98 176 C84 150 62 132 36 126', 3.2)}${leaf('M101 170 C112 146 138 140 164 150', 3)}
    ${leaf('M100 150 C104 120 96 96 88 70', 2.4)}${leaf('M101 186 C114 172 120 160 122 140', 2.2)}`;
  const bud = '';
  const bells = `${bell([46, 74], 0.12, 30, 11, 1)}${bell([140, 48], -0.16, 28, 10.5, 2)}${bell([172, 118], -0.05, 24, 9, 3)}${bell([82, 30], 0.08, 24, 9, 4)}`;
  // бант
  const loop = (s) => {
    const x = (v) => f(100 + s * v * 1.18);
    return `<path d="M${x(0)} 150 C${x(10)} 140 ${x(22)} 128 ${x(32)} 132 C${x(40)} 136 ${x(36)} 152 ${x(24)} 156 C${x(16)} 159 ${x(8)} 155 ${x(0)} 150 Z" fill="${P}" stroke="${RED}" stroke-width="1.6"/>
      <path d="M${x(3)} 150 C${x(12)} 146 ${x(20)} 142 ${x(28)} 140" stroke="${RED}" stroke-width="0.8"/>
      <path d="M${x(4)} 152 C${x(12)} 154 ${x(18)} 154 ${x(24)} 152" stroke="${RED}" stroke-width="0.6"/>`;
  };
  const tail = (d, s) => {
    const pts = poly(d, 40);
    const rb = ribbon(pts, (t) => 3.6 * Math.abs(Math.cos(Math.PI * (t * 1.15 + 0.08))) + 0.5);
    const endL = rb.left[rb.left.length - 1];
    const endR = rb.right[rb.right.length - 1];
    const mid = add(pts[pts.length - 1], mul(tangent(pts, pts.length - 1), -3));
    return `<path d="${closed([...rb.left, endL, mid, endR, ...[...rb.right].reverse()])}" fill="${P}" stroke="${RED}" stroke-width="1.4"/>`;
  };
  const ribbonBow = `
    ${tail('M99 154 C92 166 98 176 86 190', -1)}${tail('M101 154 C110 168 104 178 118 192', 1)}
    ${loop(-1)}${loop(1)}
    <path d="M94.5 145.5 C97 144 103 144 105.5 145.5 C107 149 107 153 105.5 156 C103 157.5 97 157.5 94.5 156 C93 153 93 149 94.5 145.5 Z" fill="${P}" stroke="${RED}" stroke-width="1.6"/>
    <path d="M97 147.5 C99 149 101 149 103 147.5" stroke="${RED}" stroke-width="0.7"/>`;
  return svg(`${stems}${bud}${bells}${ribbonBow}${sparkle([22, 138], 3.4, RED)}${sparkle([166, 80], 2.6)}${sparkle([140, 176], 2.2)}${sparkle([60, 20], 2)}`);
}

// ═══════════ 5. Восьминіг (ocean, illustrative dotwork) ═══════════
function octopus() {
  const tentacle = (o, headDeg, L, sign, k0, k1, w0, seed) => {
    const pts = [o];
    let th = headDeg * D;
    let p = o;
    const ds = 1.2;
    for (let s = 0; s < L; s += ds) {
      const u = s / L;
      th += sign * (k0 + k1 * u ** 3.2) * ds;
      p = add(p, [Math.cos(th) * ds, Math.sin(th) * ds]);
      pts.push(p);
    }
    const w = (t) => w0 * (1 - t) ** 0.85 + 0.45;
    const rb = ribbon(pts, w);
    const LL = lengths(pts);
    const T = LL[LL.length - 1];
    let suck = '';
    let next = T * 0.16;
    pts.forEach((q, i) => {
      if (LL[i] < next || LL[i] > T * 0.96) return;
      const t = LL[i] / T;
      const tg = tangent(pts, i);
      const n = mul([-tg[1], tg[0]], sign);
      const r = Math.max(0.55, w(t) * 0.36);
      const c = add(q, mul(n, w(t) * 0.5));
      suck += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}" fill="${P}" stroke-width="${f(Math.min(0.75, r * 0.6))}"/>`;
      next = LL[i] + r * 2 + 0.9;
    });
    // тень dotwork вдоль внешней стороны
    const shade = stipple(rb.left.concat([...rb.right].reverse()), 900, (p) => 0.55, seed, 1.3).filter((q) => {
      return true;
    });
    return `<path d="${rb.d}" fill="${P}" stroke-width="1.3"/>${dots(shade.filter((_, i) => i % 3 === 0), 0.85)}${suck}`;
  };
  const back = [
    tentacle([88, 78], 140, 100, 1, 0.002, 0.09, 4.4, 21),
    tentacle([112, 78], 42, 96, -1, 0.002, 0.092, 4.4, 22),
    tentacle([94, 80], 114, 84, -1, 0.004, 0.1, 4, 23),
    tentacle([106, 80], 68, 88, 1, 0.004, 0.1, 4, 24),
  ].join('');
  const front = [
    tentacle([84, 76], 168, 112, -1, 0.01, 0.075, 5.2, 25),
    tentacle([118, 76], 14, 108, 1, 0.01, 0.078, 5.2, 26),
    tentacle([96, 84], 102, 100, 1, 0.002, 0.1, 5, 27),
    tentacle([104, 84], 80, 96, -1, 0.002, 0.105, 5, 28),
  ].join('');
  const head = poly('M102 4 C118 5 128 20 127 38 C126 52 121 60 118 66 C123 70 125 77 120 81 C114 86 106 87 100 87 C94 87 86 86 80 81 C75 77 77 70 82 66 C79 60 74 52 73 38 C72 20 86 3 102 4 Z');
  const hd = stipple(head, 4000, (p) => Math.min(1, 0.05 + ((p[0] - 76) / 64) ** 2 * 0.9 + Math.max(0, (p[1] - 50) / 40) ** 2 * 0.6), 31, 1.35);
  const spots = [[88, 26, 2], [96, 15, 1.4], [113, 20, 1.7], [118, 38, 2.2], [102, 34, 1.2], [82, 44, 1.5], [120, 54, 1.3], [108, 56, 1]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${P}" stroke-width="0.8"/>`)
    .join('');
  const eye = (x, y, s) => `
    <path d="M${x - 7 * s} ${y} C${x - 3} ${y - 6} ${x + 3} ${y - 6} ${x + 7 * s} ${y} C${x + 3} ${y + 5} ${x - 3} ${y + 5} ${x - 7 * s} ${y} Z" fill="${P}" stroke-width="1.2"/>
    ${fillPath(`M${x - 3.6} ${y - 0.4} C${x - 2} ${y - 1.8} ${x + 2} ${y - 1.8} ${x + 3.6} ${y - 0.4} C${x + 2} ${y + 1.2} ${x - 2} ${y + 1.2} ${x - 3.6} ${y - 0.4} Z`)}
    <path d="M${x - 8} ${y - 5} C${x - 3} ${y - 9} ${x + 3} ${y - 9} ${x + 8} ${y - 5}" stroke-width="0.9"/>`;
  const body = `${back}${front}
    <path d="${closed(head)}" fill="${P}" stroke-width="1.6"/>${dots(hd, 1)}${spots}
    ${eye(86, 74, 1)}${eye(114, 72, 1)}
    ${[[154, 34, 3.2], [162, 20, 2.2], [150, 10, 1.5], [44, 22, 2.4], [38, 10, 1.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${P}" stroke-width="0.9"/>`).join('')}`;
  return svg(`<g transform="translate(100 104) scale(0.86) translate(-100 -100)">${body}</g>`);
}

// ═══════════ 6. Змія і кинджал (нео-традишнл, чорний + червоний) ═══════════
function dagger() {
  // кинджал
  const grip = `<path d="M94.5 22 L105.5 22 L105 52 L95 52 Z" fill="${P}" stroke-width="1.4"/>
    <path d="${[0, 1, 2, 3, 4, 5].map((k) => `M95 ${25 + k * 5}L105 ${29 + k * 5}`).join('')}" stroke-width="1"/>`;
  const pommel = `<circle cx="100" cy="15" r="6.5" fill="${P}" stroke-width="1.4"/><circle class="fill" cx="100" cy="15" r="2.6" fill="${RED}" stroke="none"/>`;
  const guard = `<path d="M100 52 C112 52 124 49 132 46 C138 44 142 48 139 53 C136 57 130 55 131 51 C122 56 112 59 100 59 C88 59 78 56 69 51 C70 55 64 57 61 53 C58 48 62 44 68 46 C76 49 88 52 100 52 Z" fill="${P}" stroke-width="1.4"/>
    <circle class="fill" cx="100" cy="55.5" r="2" fill="${INK}" stroke="none"/>`;
  const bladeP = poly('M92.5 59 L107.5 59 L106 150 C105 164 102 176 100 186 C98 176 95 164 94 150 Z', 12);
  const shine = stipple(bladeP, 2500, (p) => (p[0] > 100 ? 0.85 : 0.05), 51, 1.25);
  const bladeSvg = `<path d="${closed(bladeP)}" fill="${P}" stroke-width="1.5"/>${dots(shine, 0.95)}
    <path d="M100 63 L100 168" stroke-width="0.9"/>
    ${fillPath('M100 189 C102.6 192.5 103 195 100 197 C97 195 97.4 192.5 100 189 Z', RED)}`;

  // змея: шея + спираль вокруг клинка
  const neck = poly('M138 30 C128 34 122 50 124 66', 16);
  const helix = [];
  const ph0 = Math.PI / 2;
  const turns = 2.35;
  for (let k = 0; k <= 220; k++) {
    const u = k / 220;
    const ph = ph0 + u * turns * 2 * Math.PI;
    const A = lerp(25, 13, u);
    helix.push([100 + A * Math.sin(ph), lerp(70, 176, u), Math.cos(ph)]);
  }
  // сшиваем шею со спиралью
  const start = helix[0];
  const join = poly(`M124 66 C125 68 ${f(start[0] + 1)} ${f(start[1] - 3)} ${f(start[0])} ${f(start[1])}`, 6).slice(1, -1);
  const center = [...neck, ...join, ...helix.map(([x, y]) => [x, y])];
  const front = [...neck.map(() => 1), ...join.map(() => 1), ...helix.map((h) => h[2])];
  const L = lengths(center);
  const T = L[L.length - 1];
  const w = (t) => (t < 0.05 ? lerp(5, 6.4, t / 0.05) : t > 0.55 ? lerp(6.4, 0.6, ((t - 0.55) / 0.45) ** 1.2) : 6.4);
  const rb = ribbon(center, w);
  // разбиваем на участки «спереди/сзади»
  const parts = [];
  let cur = null;
  center.forEach((_, i) => {
    const isFront = front[i] > -0.02;
    if (!cur || cur.front !== isFront) {
      cur = { front: isFront, idx: [] };
      if (parts.length) cur.idx.push(i - 1);
      parts.push(cur);
    }
    cur.idx.push(i);
  });
  const seg = ({ idx }) => {
    const l = idx.map((i) => rb.left[i]);
    const r = idx.map((i) => rb.right[i]);
    let s = `<path d="${closed([...l, ...r.reverse()])}" fill="${P}" stroke="none"/><path d="${line(l)}${line(idx.map((i) => rb.right[i]))}" stroke-width="1.4"/>`;
    // брюшные щитки и красные ромбы
    let scutes = '';
    let rh = '';
    const belly = idx.filter((i) => w(L[i] / T) > 1.2);
    if (belly.length > 1) {
      const outer = belly.map((i) => add(center[i], mul(sub(rb.right[i], center[i]), 0.97)));
      const inner = belly.map((i) => add(center[i], mul(sub(rb.right[i], center[i]), 0.12)));
      s = s.replace('stroke="none"/>', `stroke="none"/>${fillPath(closed([...outer, ...inner.reverse()]), RED)}`);
    }
    idx.forEach((i, n) => {
      if (n === 0) return;
      const t = L[i] / T;
      const ww = w(t);
      if (ww < 1.4) return;
      if (i % 3 === 0) scutes += `M${pt(add(center[i], mul(sub(rb.right[i], center[i]), 0.97)))}L${pt(add(center[i], mul(sub(rb.right[i], center[i]), 0.12)))}`;
      if (false) {
        const tg = tangent(center, i);
        const nn = [-tg[1], tg[0]];
        const c = add(center[i], mul(nn, -ww * 0.18));
        const a = mul(tg, ww * 0.62);
        const b = mul(nn, ww * 0.36);
        rh += `M${pt(add(c, a))}L${pt(add(c, b))}L${pt(sub(c, a))}L${pt(sub(c, b))}Z`;
      }
    });
    s += `<path d="${scutes}" stroke-width="0.8"/>`;
    // точки-чешуя на спинке
    const sc = idx.filter((i, n) => n % 4 === 2 && w(L[i] / T) > 2.4).map((i) => add(center[i], mul(sub(rb.left[i], center[i]), 0.45)));
    s += dots(sc, 1.3);
    return s;
  };
  const backSegs = parts.filter((p) => !p.front).map(seg).join('');
  const frontSegs = parts.filter((p) => p.front).map(seg).join('');
  // голова у начала шеи, смотрит вверх-влево
  const H = [138, 30];
  const dir = norm(sub(neck[0], neck[3]));
  const nx = [-dir[1], dir[0]];
  const at = (a, b) => add(H, add(mul(dir, a * 1.25), mul(nx, b * 1.25)));
  const head = `<path d="M${pt(at(-3, 5.4))}C${pt(at(4, 7.4))} ${pt(at(11, 5.6))} ${pt(at(15, 1.6))}C${pt(at(16.2, 0))} ${pt(at(16.2, -1.2))} ${pt(at(15, -2.2))}C${pt(at(11, -6))} ${pt(at(4, -7.4))} ${pt(at(-3, -5.4))}Z" fill="${P}" stroke-width="1.4"/>
    <circle cx="${f(at(6, 2.6)[0])}" cy="${f(at(6, 2.6)[1])}" r="2.1" fill="${P}" stroke-width="1"/>
    ${fillPath(`M${pt(at(6, 4.2))}L${pt(at(6.6, 2.6))}L${pt(at(6, 1))}L${pt(at(5.4, 2.6))}Z`)}
    <path d="M${pt(at(-2, 3.6))}C${pt(at(3, 4.4))} ${pt(at(8, 3.6))} ${pt(at(11, 2.4))}" stroke-width="0.7"/>
    <path d="M${pt(at(15.6, -0.6))}L${pt(at(22, -0.6))}L${pt(at(25.5, 1.8))}M${pt(at(22, -0.6))}L${pt(at(25.5, -2.8))}" stroke="${RED}" stroke-width="1.2"/>`;
  return svg(`${backSegs}${bladeSvg}${guard}${grip}${pommel}${frontSegs}${head}${sparkle([40, 120], 3.6)}${sparkle([160, 150], 2.6, RED)}${sparkle([56, 40], 2.2)}`);
}

mkdirSync(OUT, { recursive: true });
const all = { luna, sigil, sternum, bow, octopus, dagger };
for (const [id, make] of Object.entries(all)) {
  const s = make();
  writeFileSync(new URL(`${id}.svg`, OUT), s);
  console.log(`${id}.svg  ${(s.length / 1024).toFixed(1)} KB`);
}
