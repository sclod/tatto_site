// Демо-эскизы (флеши), нарисованные кодом. Заменяются на реальные эскизы мастера:
// положите PNG в public/flash/ и укажите `src: 'flash/имя.png'` вместо `svg`.

import { L, t } from '../i18n.js';

const INK = '#16151B';
const RED = '#D23A1E';

const wrap = (body, vb = '0 0 200 200') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="${vb}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const sparkle = (x, y, r) =>
  `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z" fill="${INK}" stroke="none"/>`;

const moth = wrap(`
  <path d="M94 86 C70 48 30 44 22 70 C16 92 42 110 94 104 Z"/>
  <path d="M106 86 C130 48 170 44 178 70 C184 92 158 110 106 104 Z"/>
  <path d="M95 108 C70 116 44 140 54 160 C64 176 88 156 97 124 Z"/>
  <path d="M105 108 C130 116 156 140 146 160 C136 176 112 156 103 124 Z"/>
  <circle cx="54" cy="76" r="11"/><circle cx="54" cy="76" r="4" fill="${INK}"/>
  <circle cx="146" cy="76" r="11"/><circle cx="146" cy="76" r="4" fill="${INK}"/>
  <path d="M38 92 C56 96 72 98 90 98 M162 92 C144 96 128 98 110 98"/>
  <path d="M64 150 C74 142 84 132 92 120 M136 150 C126 142 116 132 108 120"/>
  <ellipse cx="100" cy="104" rx="6" ry="30" fill="__PAPER__"/>
  <path d="M95 104 H105 M95 112 H105 M95.5 120 H104.5 M97 127 H103"/>
  <circle cx="100" cy="70" r="6" fill="${INK}"/>
  <path d="M97 65 C90 50 82 44 72 42 M103 65 C110 50 118 44 128 42"/>
  <circle cx="72" cy="42" r="1.8" fill="${INK}"/><circle cx="128" cy="42" r="1.8" fill="${INK}"/>
`);

const snakeBody = 'M58 182 C18 160 30 120 92 116 C150 112 178 86 152 58 C138 43 122 44 114 52';
const snake = wrap(`
  <path d="${snakeBody}" stroke-width="17"/>
  <path d="${snakeBody}" stroke="__PAPER__" stroke-width="12.6"/>
  <path d="${snakeBody}" stroke-width="1.4" stroke-dasharray="1 7"/>
  <path d="M58 182 C50 178 44 176 36 178" stroke-width="5"/>
  <path d="M120 46 C112 38 96 40 90 50 C86 58 92 68 104 66 C112 64 118 58 120 46 Z" fill="__PAPER__"/>
  <circle cx="104" cy="51" r="2.4" fill="${INK}"/>
  <path d="M91 58 L78 66 M78 66 L72 63 M78 66 L74 72" stroke="${RED}" stroke-width="1.8"/>
  ${sparkle(160, 150, 9)}${sparkle(40, 70, 6)}
`);

const flower = wrap(`
  <path d="M100 192 C97 150 105 112 100 66"/>
  <path d="M100 150 C80 142 70 126 66 112 C82 116 94 130 100 150 Z"/>
  <path d="M100 150 C82 142 72 128 66 112" stroke-width="1"/>
  <path d="M101 122 C120 116 132 102 136 88 C120 92 106 104 101 122 Z"/>
  <path d="M101 122 C118 114 130 100 136 88" stroke-width="1"/>
  <path d="M100 96 C90 92 84 84 82 76"/>
  <ellipse cx="80" cy="72" rx="5" ry="9" transform="rotate(-30 80 72)"/>
  ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="100" cy="38" rx="9" ry="17" transform="rotate(${a} 100 54)"/>`).join('')}
  <circle cx="100" cy="54" r="7" fill="${INK}"/>
  <circle cx="92" cy="40" r="1.4" fill="${INK}"/><circle cx="110" cy="44" r="1.4" fill="${INK}"/><circle cx="96" cy="66" r="1.4" fill="${INK}"/>
`);

const rays = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2;
  const r1 = i % 2 ? 66 : 62;
  const r2 = i % 2 ? 76 : 86;
  const p = (r) => `${(100 + Math.cos(a) * r).toFixed(1)} ${(100 + Math.sin(a) * r).toFixed(1)}`;
  return `M${p(r1)} L${p(r2)}`;
}).join(' ');
const eye = wrap(`
  <path d="${rays}" stroke-width="1.6"/>
  <path d="M40 100 Q100 52 160 100 Q100 148 40 100 Z" fill="__PAPER__"/>
  <circle cx="100" cy="100" r="22"/>
  <circle cx="100" cy="100" r="15" stroke-width="1" stroke-dasharray="2 3"/>
  <circle cx="100" cy="100" r="9" fill="${INK}"/>
  <circle cx="95" cy="95" r="3" fill="__PAPER__" stroke="none"/>
  <path d="M100 150 C94 162 94 170 100 172 C106 170 106 162 100 150 Z" fill="${INK}"/>
`);

const moon = wrap(`
  <circle cx="100" cy="100" r="86" stroke-width="1.2" stroke-dasharray="1 6"/>
  <path d="M118 36 A64 64 0 1 0 118 164 A52 52 0 1 1 118 36 Z" fill="__PAPER__"/>
  <path d="M100 52 A50 50 0 0 0 100 148" stroke-width="1" stroke-dasharray="3 4"/>
  <circle cx="82" cy="80" r="3"/><circle cx="74" cy="112" r="5"/><circle cx="90" cy="134" r="2.2"/>
  ${sparkle(150, 70, 13)}${sparkle(162, 122, 8)}${sparkle(132, 150, 5)}${sparkle(40, 40, 6)}
`);

const heart = wrap(`
  <path d="M100 172 C40 126 28 82 60 62 C80 50 96 62 100 80 C104 62 120 50 140 62 C172 82 160 126 100 172 Z" fill="${RED}"/>
  <path d="M100 160 C52 122 42 88 64 72" stroke="__PAPER__" stroke-width="3"/>
  <path d="M100 42 V24 M74 46 L66 30 M126 46 L134 30" stroke-width="2"/>
  <path d="M34 112 L16 112 L24 123 L16 134 L34 134 Z" fill="__PAPER__"/>
  <path d="M166 112 L184 112 L176 123 L184 134 L166 134 Z" fill="__PAPER__"/>
  <path d="M30 106 H170 V128 H30 Z" fill="__PAPER__"/>
  <path d="M30 128 L34 134 M170 128 L166 134"/>
  <text x="100" y="123.5" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" font-weight="700" letter-spacing="2.5" fill="${INK}" stroke="none">${t('forever')}</text>
`);

const price = (n) => ({ uk: `від ${n.toLocaleString('uk-UA')} ₴`, en: `from ₴${n.toLocaleString('en-US')}` });

export const flash = [
  { id: 'moth', title: { uk: 'Нічний метелик', en: 'Night moth' }, price: price(2500), size: 7, svg: moth, mono: true },
  { id: 'snake', title: { uk: 'Змія-оберіг', en: 'Guardian snake' }, price: price(3500), size: 9, svg: snake, mono: false },
  { id: 'flower', title: { uk: 'Польова квітка', en: 'Wildflower' }, price: price(2000), size: 8, svg: flower, mono: true },
  { id: 'eye', title: { uk: 'Всевидюче око', en: 'All-seeing eye' }, price: price(3000), size: 7, svg: eye, mono: true },
  { id: 'moon', title: { uk: 'Місяць та іскри', en: 'Moon and sparks' }, price: price(2200), size: 6, svg: moon, mono: true },
  { id: 'heart', title: { uk: 'Назавжди', en: 'Forever' }, price: price(3000), size: 7, svg: heart, mono: false },
].map((f) => ({ ...f, title: L(f.title), price: L(f.price) }));

// __PAPER__ — «пустоты» внутри рисунка: на сайте это цвет бумаги,
// в примерочной — белый (при умножении белый не меняет кожу).
export const paintSvg = (svg, paper = '#EEE8DC') => svg.replaceAll('__PAPER__', paper);
export const svgToUrl = (svg, paper) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(paintSvg(svg, paper))}`;
