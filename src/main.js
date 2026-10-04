import '@fontsource-variable/unbounded/wght.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/caveat/500.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './styles/main.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { translatePage, bindLangSwitch, L, lang } from './i18n.js';
import { site, works } from './data/site.js';
import { inkTrail } from './ui/ink-trail.js';
import { weightLetters, clock } from './ui/hero.js';
import { gallery, flashSheet, pills, plate } from './ui/gallery.js';
import { flash, svgToUrl } from './data/flash.js';
import { tryOnUI } from './ui/tryon-ui.js';
import { booking } from './ui/booking.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ——— плавный скролл ———
const lenis = new Lenis({ anchors: { offset: -10 }, lerp: 0.11, prevent: (node) => node.closest?.('.lightbox') });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
addEventListener('modal:open', () => lenis.stop());
addEventListener('modal:close', () => lenis.start());
addEventListener('layout:change', () => ScrollTrigger.refresh());

// ——— язык: статичный текст страницы — до запуска остальных модулей ———
translatePage();
bindLangSwitch();

// ——— статичные данные ———
$$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
$('[data-city]').textContent = `${L(site.city)} · ${L(site.studio)}`;
clock($('[data-clock]'), site.timezone, L(site.city), lang === 'uk' ? 'uk-UA' : 'en-GB');

// ——— модули ———
inkTrail($('.ink-trail'));
const letters = weightLetters($('[data-weight-letters]'));
pills($('.manifest'));
plate($('[data-plate]'));
const cards = gallery({ grid: $('[data-works]'), filter: $('[data-filter]'), works, lightbox: $('[data-lightbox]') });
const tryon = tryOnUI($('[data-tryon]'));
// ссылки на отдельную страницу примерочной — с текущим языком
const tryonUrl = (design) => {
  const q = new URLSearchParams();
  if (design) q.set('design', design);
  if (lang === 'en') q.set('lang', 'en');
  const qs = q.toString();
  return `tryon.html${qs ? `?${qs}` : ''}`;
};
$$('[data-tryon-link]').forEach((a) => (a.href = tryonUrl()));
$('[data-cta-art]').innerHTML = `<img src="${svgToUrl(flash[0].svg)}" alt="" />`;
const phone = matchMedia('(max-width: 800px)');
flashSheet($('[data-flash]'), (id) => {
  if (phone.matches) {
    location.href = tryonUrl(id);
    return;
  }
  tryon.tryFlash(id);
  lenis.scrollTo('#tryon', { offset: -10 });
});
booking($('[data-book]'), site);
addEventListener('tryon:shot', () => lenis.scrollTo('#book', { offset: -10 }));

// штрихкод на «чеке»
{
  const svg = $('[data-barcode]');
  let x = 0;
  let bars = '';
  while (x < 196) {
    const w = 1 + Math.floor(Math.random() * 3);
    if (Math.random() > 0.35) bars += `<rect x="${x}" y="0" width="${w}" height="40" fill="currentColor"/>`;
    x += w + 1;
  }
  svg.innerHTML = bars;
}

// ——— загрузка и интро ———
const loader = $('.loader');
const count = $('.loader__count');
const bar = $('.loader__line i');
const started = performance.now();
const progress = { v: 0 };
const fontsReady = document.fonts.ready;

if (reduce) {
  loader.remove();
  document.documentElement.classList.add('is-loaded');
} else {
  gsap.set($$('.hero__meta, .hero__row, .hero__foot, .stamp'), { opacity: 0, y: 20 });
  gsap.set(letters, { yPercent: 110 });
  gsap.set($('.hero__name'), { overflow: 'hidden', paddingBottom: '0.04em' });
  const tick = gsap.to(progress, {
    v: 90,
    duration: 1.1,
    ease: 'power2.out',
    onUpdate: () => {
      count.textContent = String(Math.round(progress.v)).padStart(3, '0');
      bar.style.transform = `scaleX(${progress.v / 100})`;
    },
  });
  fontsReady.then(() => {
    const wait = Math.max(0, 900 - (performance.now() - started));
    gsap.delayedCall(wait / 1000, () => {
      tick.kill();
      gsap
        .timeline()
        .to(progress, {
          v: 100,
          duration: 0.35,
          onUpdate: () => {
            count.textContent = String(Math.round(progress.v)).padStart(3, '0');
            bar.style.transform = `scaleX(${progress.v / 100})`;
          },
        })
        .to(loader, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' })
        .add(() => {
          loader.remove();
          document.documentElement.classList.add('is-loaded');
        })
        .to(letters, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06 }, '-=0.45')
        .to($$('.hero__meta, .hero__row, .hero__foot, .stamp'), { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 }, '-=0.8')
        .add(() => gsap.set($('.hero__name'), { overflow: 'visible' }));
    });
  });
}

// ——— манифест: слова прокрашиваются чернилами ———
{
  const root = $('[data-reveal-words]');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) return frag.append(part);
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = part;
      frag.append(s);
    });
    node.replaceWith(frag);
  });
  const words = $$('.w', root);
  if (reduce) words.forEach((w) => w.classList.add('is-on'));
  else
    ScrollTrigger.create({
      trigger: root,
      start: 'top 80%',
      end: 'bottom 45%',
      onUpdate: (st) => {
        const n = Math.round(st.progress * words.length);
        words.forEach((w, i) => w.classList.toggle('is-on', i < n));
      },
    });
}

if (!reduce) {
  // карточки работ проявляются снизу
  cards.forEach((c) => {
    gsap.from(c, {
      y: 80,
      opacity: 0,
      duration: 1.2,
      ease: 'expo.out',
      scrollTrigger: { trigger: c, start: 'top 92%' },
    });
  });

  // заголовки секций: буквы въезжают
  $$('.section-head h2').forEach((h) => {
    gsap.from(h, { yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%' } });
  });

  // горизонтальная лента флешей (только десктоп)
  ScrollTrigger.matchMedia({
    '(min-width: 801px)': () => {
      const track = $('[data-flash]');
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      const tween = gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.flash__pin',
          start: 'top top',
          end: () => `+=${dist()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
      return () => tween.kill();
    },
  });

  // чек «печатается» из кассы
  gsap.fromTo(
    '[data-receipt]',
    { yPercent: -100 },
    { yPercent: 0, ease: 'steps(14)', scrollTrigger: { trigger: '.care__slot', start: 'top 85%', end: 'top 30%', scrub: true } },
  );
}

// ——— протокол: номер шага ———
{
  const num = $('[data-step-num]');
  $$('[data-step]').forEach((li) => {
    ScrollTrigger.create({
      trigger: li,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (st) => {
        if (!st.isActive || num.textContent === li.dataset.step) return;
        num.textContent = li.dataset.step;
        if (!reduce) gsap.fromTo(num, { yPercent: 18, opacity: 0.2 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out' });
      },
    });
  });
}

fontsReady.then(() => ScrollTrigger.refresh());
