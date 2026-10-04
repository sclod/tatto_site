import { flash, svgToUrl, paintSvg } from '../data/flash.js';
import { L, t, lang } from '../i18n.js';
import { esc } from './esc.js';

const byId = Object.fromEntries(flash.map((f) => [f.id, f]));
const pad = (n) => String(n).padStart(3, '0');

function media(w) {
  if (w.img) {
    return `<div class="work__media"><img src="${esc(w.img)}" alt="${esc(w.title)}" loading="lazy" /></div>`;
  }
  // заглушка: эскиз «на коже», пока нет реальных фото
  const f = byId[w.flash];
  return `<div class="work__media work__media--skin">
      <img src="${svgToUrl(f.svg, '#FFFFFF')}" alt="${esc(w.title)}" loading="lazy" />
      <span class="work__badge mono">${t('photoSoon')}</span>
    </div>`;
}

export function gallery({ grid, filter, works: source, lightbox }) {
  const hours = (h) => (lang === 'uk' ? String(h).replace('.', ',') : String(h));
  const works = source.map((w) => ({ ...w, title: L(w.title), zone: L(w.zone), styleLabel: t(w.style) }));
  grid.innerHTML = works
    .map(
      (w, i) => `
      <div class="work" role="button" tabindex="0" aria-label="${esc(t('open', { title: w.title }))}" data-i="${i}" data-style="${esc(w.style)}">
        ${media(w)}
        <span class="work__pass mono">
          <span class="work__no">№ ${pad(w.id)}</span>
          <span class="work__title">${esc(w.title)}</span>
          <span>${w.size} ${t('cm')}</span>
          <span class="work__meta">${esc(w.styleLabel)} · ${esc(w.zone)} · ${hours(w.hours)} ${t('hours')}</span>
        </span>
      </div>`,
    )
    .join('');

  const cards = [...grid.children];
  const styles = ['all', ...new Set(works.map((w) => w.style))];
  filter.innerHTML = styles
    .map((s, i) => `<button type="button" aria-pressed="${i === 0}" data-s="${esc(s)}">${esc(t(s))}</button>`)
    .join('');
  filter.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    filter.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    cards.forEach((c) => c.classList.toggle('is-hidden', b.dataset.s !== 'all' && c.dataset.style !== b.dataset.s));
    window.dispatchEvent(new Event('layout:change'));
  });

  // ——— лайтбокс ———
  const lb = lightbox;
  const lbMedia = lb.querySelector('[data-lb-media]');
  const lbCap = lb.querySelector('[data-lb-cap]');
  let cur = 0;
  const visibleIdx = () => cards.filter((c) => !c.classList.contains('is-hidden')).map((c) => +c.dataset.i);
  const show = (i) => {
    cur = i;
    const w = works[i];
    lbMedia.innerHTML = media(w);
    lbCap.textContent = `№ ${pad(w.id)} — ${w.title} · ${w.styleLabel} · ${w.zone} · ${w.size} ${t('cm')}`;
  };
  const step = (d) => {
    const v = visibleIdx();
    show(v[(v.indexOf(cur) + d + v.length) % v.length]);
  };
  const open = (i) => {
    show(i);
    lb.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    window.dispatchEvent(new Event('modal:open'));
    lb.querySelector('[data-lb-close]').focus();
  };
  const close = () => {
    lb.hidden = true;
    document.documentElement.style.overflow = '';
    window.dispatchEvent(new Event('modal:close'));
    cards[cur]?.focus();
  };
  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.work');
    if (c) open(+c.dataset.i);
  });
  grid.addEventListener('keydown', (e) => {
    const c = e.target.closest('.work');
    if (c && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      open(+c.dataset.i);
    }
  });
  lb.querySelector('[data-lb-close]').addEventListener('click', close);
  lb.querySelector('[data-lb-prev]').addEventListener('click', () => step(-1));
  lb.querySelector('[data-lb-next]').addEventListener('click', () => step(1));
  lb.addEventListener('click', (e) => e.target === lb && close());
  addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  return cards;
}

export function flashSheet(track, onTry) {
  track.innerHTML = flash
    .map(
      (f, i) => `
      <article class="flash-card">
        <div class="flash-card__no mono"><span>${t('sheet')} ${pad(i + 1)}</span><span>~${f.size} ${t('cm')}</span></div>
        <img src="${svgToUrl(f.svg, '#F6F1E7')}" alt="${esc(t('sketchAlt', { title: f.title }))}" loading="lazy" />
        <h3>${esc(f.title)}</h3>
        <div class="flash-card__foot">
          <span class="hand">${esc(f.price)}</span>
          <button type="button" class="btn" data-try="${f.id}">${t('tryOn')}</button>
        </div>
      </article>`,
    )
    .join('');
  track.addEventListener('click', (e) => {
    const b = e.target.closest('[data-try]');
    if (b) onTry(b.dataset.try);
  });
}

export function pills(root) {
  root.querySelectorAll('[data-pill]').forEach((img) => {
    const f = byId[img.dataset.pill];
    img.src = svgToUrl(f.svg, '#E4DCCB');
  });
}

// «Рисунок 1» в hero: эскиз прорисовывается линия за линией.
export function plate(el) {
  el.innerHTML = paintSvg(byId.moth.svg).replace(/ width="1000" height="1000"/, '');
  el.querySelectorAll('path, circle, ellipse').forEach((n) => {
    n.setAttribute('pathLength', '1');
    n.classList.add('draw');
  });
}
