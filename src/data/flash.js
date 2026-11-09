// Демо-эскизы (флеши). Нарисованы кодом с нуля скриптом tools/flash-gen.mjs
// (мотивы по трендам 2025–2026) и лежат в src/data/flash/*.svg.
// Заменяются на реальные эскизы мастера: положите PNG в public/flash/
// и укажите `src: 'flash/имя.png'` вместо `svg`.

import { L } from '../i18n.js';
import luna from './flash/luna.svg?raw';
import sigil from './flash/sigil.svg?raw';
import sternum from './flash/sternum.svg?raw';
import bow from './flash/bow.svg?raw';
import octopus from './flash/octopus.svg?raw';
import dagger from './flash/dagger.svg?raw';

// mono: в примерочной эскиз сразу ставится в режиме ч-б (у цветных — с красным)
export const flash = [
  { id: 'luna', title: { uk: 'Місячний метелик', en: 'Luna moth' }, size: 10, svg: luna, mono: true },
  { id: 'sigil', title: { uk: 'Кібер-сигіл', en: 'Cyber sigil' }, size: 16, svg: sigil, mono: true },
  { id: 'bow', title: { uk: 'Бант і рябчики', en: 'Bow & fritillaries' }, size: 9, svg: bow, mono: false },
  { id: 'sternum', title: { uk: 'Орнамент-люстра', en: 'Chandelier ornament' }, size: 15, svg: sternum, mono: true },
  { id: 'dagger', title: { uk: 'Змія і кинджал', en: 'Snake & dagger' }, size: 13, svg: dagger, mono: false },
  { id: 'octopus', title: { uk: 'Восьминіг', en: 'Octopus' }, size: 12, svg: octopus, mono: true },
].map((f) => ({ ...f, title: L(f.title) }));

// __PAPER__ — «пустоты» внутри рисунка: на сайте это цвет бумаги,
// в примерочной — белый (при умножении белый не меняет кожу).
export const paintSvg = (svg, paper = '#EEE8DC') => svg.replaceAll('__PAPER__', paper);
export const svgToUrl = (svg, paper) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(paintSvg(svg, paper))}`;
