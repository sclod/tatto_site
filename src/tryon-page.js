// Отдельная страница 3D-примерочной: на весь экран, удобная для телефона.
import '@fontsource-variable/unbounded/wght.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/caveat/500.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './styles/main.css';
import './styles/tryon-page.css';

import { translatePage, bindLangSwitch, lang } from './i18n.js';
import { site } from './data/site.js';
import { tryOnUI } from './ui/tryon-ui.js';
import { booking } from './ui/booking.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

translatePage({ title: 'titleTryon', description: 'descTryon' });
bindLangSwitch();
$('[data-home]').href = lang === 'en' ? './?lang=en' : './';

const root = $('[data-tryon]');
const ui = tryOnUI(root, { zoom: true, eager: true });

// ?design=moth — пришли с флеш-листа по кнопке «приміряти»
const design = new URLSearchParams(location.search).get('design');
if (design) ui.tryFlash(design);

// ——— вкладки панели ———
const setTab = (name) => {
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== name));
};
$$('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
// выбрал эскиз — сразу показываем настройки посадки
root.addEventListener('click', (e) => {
  if (e.target.closest('[data-design]')) setTab('fit');
});
$('[data-upload]').addEventListener('change', () => setTab('fit'));

// подсказка исчезает после первого касания фигуры
const hint = $('.tp__hint');
$('[data-tryon-canvas]').addEventListener('pointerdown', () => hint?.classList.add('is-gone'), { once: true });

// ——— заявка в выезжающей шторке ———
const sheet = $('[data-book-sheet]');
const form = $('[data-book]');
booking(form, site);
const open = () => {
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  form.elements.idea.focus({ preventScroll: true });
};
const close = () => {
  sheet.classList.remove('is-open');
  setTimeout(() => (sheet.hidden = true), 250);
};
addEventListener('tryon:shot', open);
$('[data-book-close]').addEventListener('click', close);
sheet.addEventListener('click', (e) => e.target === sheet && close());
addEventListener('keydown', (e) => e.key === 'Escape' && !sheet.hidden && close());
form.addEventListener('booking:sent', () => setTimeout(close, 2500));
