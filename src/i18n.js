// Языки сайта: украинский — основной, английский — по переключателю.
// Выбор берётся из ?lang=en|uk, затем из localStorage, иначе — украинский.
import { pageEn } from './i18n-page-en.js';

const LANGS = ['uk', 'en'];

const fromUrl = new URLSearchParams(location.search).get('lang');
let stored = null;
try {
  stored = localStorage.getItem('lang');
} catch {
  /* приватный режим — просто без запоминания */
}

export const lang = LANGS.includes(fromUrl) ? fromUrl : LANGS.includes(stored) ? stored : 'uk';

/** Значение на текущем языке из объекта вида { uk, en }; строки возвращаются как есть. */
export const L = (v) => (v && typeof v === 'object' && 'uk' in v ? (v[lang] ?? v.uk) : v);

const S = {
  // заявка
  ideaFromShot: { uk: 'Хочу «{title}» — приміряв(ла) на сайті', en: 'I’d like “{title}” — tried it on the site' },
  msgHi: { uk: 'Привіт! Мене звати {name}.', en: 'Hi! My name is {name}.' },
  msgIdea: { uk: 'Ідея: {v}', en: 'Idea: {v}' },
  msgZone: { uk: 'Зона: {v}', en: 'Placement: {v}' },
  msgSize: { uk: 'Розмір: ~{v} см', en: 'Size: ~{v} cm' },
  msgWhen: { uk: 'Зручно: {v}', en: 'Preferred: {v}' },
  msgShot: { uk: '(додаю знімок з примірочної)', en: '(attaching a try-on snapshot)' },
  statusCopied: { uk: 'Текст скопійовано ✓ Встав його у відкритий чат', en: 'Text copied ✓ Paste it into the chat that opened' },
  statusShot: { uk: ' і прикріпи завантажений знімок.', en: ' and attach the saved snapshot.' },
  statusFail: { uk: 'Відкриваємо чат — напиши ідею, зону й розмір.', en: 'Opening the chat — write your idea, placement and size.' },
  // каталог и флеши
  photoSoon: { uk: 'фото скоро', en: 'photo soon' },
  open: { uk: 'Відкрити: {title}', en: 'Open: {title}' },
  cm: { uk: 'см', en: 'cm' },
  hours: { uk: 'год', en: 'h' },
  all: { uk: 'усі', en: 'all' },
  sheet: { uk: 'аркуш', en: 'sheet' },
  sketchAlt: { uk: 'Ескіз «{title}»', en: 'Sketch “{title}”' },
  tryOn: { uk: 'приміряти →', en: 'try on →' },
  forever: { uk: 'НАЗАВЖДИ', en: 'FOREVER' },
  // стили
  graphic: { uk: 'графіка', en: 'graphic' },
  color: { uk: 'колір', en: 'colour' },
  fineline: { uk: 'fine line', en: 'fine line' },
  // примерочная
  viewFull: { uk: 'Цілком', en: 'Full' },
  viewArm: { uk: 'Рука', en: 'Arm' },
  viewBack: { uk: 'Спина', en: 'Back' },
  viewChest: { uk: 'Груди', en: 'Chest' },
  viewLeg: { uk: 'Нога', en: 'Leg' },
  viewNeck: { uk: 'Шия', en: 'Neck' },
  loadFail: { uk: 'не вдалося завантажити 3D — онови сторінку', en: 'couldn’t load 3D — refresh the page' },
  yourSketch: { uk: 'Твій ескіз', en: 'Your sketch' },
  skinPlaster: { uk: 'Гіпс', en: 'Plaster' },
  skinPorcelain: { uk: 'Порцеляна', en: 'Porcelain' },
  skinPeach: { uk: 'Персик', en: 'Peach' },
  skinOlive: { uk: 'Оливка', en: 'Olive' },
  skinCaramel: { uk: 'Карамель', en: 'Caramel' },
  skinCocoa: { uk: 'Какао', en: 'Cocoa' },
  skinEbony: { uk: 'Ебоні', en: 'Ebony' },
  shotDefault: { uk: 'примірка', en: 'try-on' },
  shotNote: { uk: 'приміряно на сайті ↗', en: 'tried on at the site ↗' },
  shotFile: { uk: 'valova-prymirka.jpg', en: 'valova-try-on.jpg' },
};

export const t = (key, vars = {}) => (L(S[key]) ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// Статичный текст страницы написан по-украински прямо в index.html;
// для английского подменяем элементы с data-i18n / data-i18n-attr.
export function translatePage() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  if (lang === 'uk') return;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = pageEn[el.dataset.i18n];
    if (v !== undefined) el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      if (pageEn[key] !== undefined) el.setAttribute(attr, pageEn[key]);
    }
  });
  document.title = pageEn.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', pageEn.description);
}

export function bindLangSwitch() {
  document.querySelectorAll('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => {
      const next = b.dataset.lang;
      if (next === lang) return;
      try {
        localStorage.setItem('lang', next);
      } catch {
        /* без запоминания */
      }
      const url = new URL(location.href);
      url.searchParams.set('lang', next);
      url.hash = '';
      location.href = url.toString();
    }),
  );
}
