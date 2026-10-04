// Буквы имени «набухают» рядом с курсором — вариативная жирность Unbounded (200–900).
export function weightLetters(el) {
  const text = el.textContent.trim();
  el.textContent = '';
  const half = Math.ceil(text.length / 2);
  const letters = [...text].map((ch, i) => {
    // на телефоне имя переносится на две строки — так оно крупнее
    if (i === half) el.insertAdjacentHTML('beforeend', '<i class="hero__br" aria-hidden="true"></i>');
    const s = document.createElement('span');
    s.textContent = ch;
    s.setAttribute('aria-hidden', 'true');
    el.appendChild(s);
    return { el: s, w: 560, target: 560 };
  });

  const REST = 560;
  let pointer = null;
  const touch = matchMedia('(pointer: coarse)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return letters.map((l) => l.el);

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'mouse') pointer = { x: e.clientX, y: e.clientY };
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => (pointer = null));

  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(el);

  const tick = (time) => {
    requestAnimationFrame(tick);
    if (!visible) return;
    // сначала читаем все размеры, потом пишем стили — один пересчёт вёрстки за кадр, а не шесть
    const rects = pointer && !touch ? letters.map((l) => l.el.getBoundingClientRect()) : null;
    letters.forEach((l, i) => {
      if (rects) {
        const r = rects[i];
        const d = Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2));
        const fall = Math.max(260, innerWidth * 0.22);
        l.target = REST - 340 + 680 * Math.exp(-((d / fall) ** 2));
      } else {
        // без мыши — медленная волна
        l.target = REST + 300 * Math.sin(time / 900 - i * 0.7);
      }
      l.w += (l.target - l.w) * 0.12;
      // пишем стиль только при заметном изменении — меньше пересчётов вёрстки
      const w = Math.round(l.w / 4) * 4;
      if (w !== l.shown) {
        l.shown = w;
        l.el.style.fontVariationSettings = `'wght' ${w}`;
      }
    });
  };
  requestAnimationFrame(tick);
  return letters.map((l) => l.el);
}

export function clock(el, tz, city, locale) {
  const fmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: tz });
  const draw = () => (el.textContent = `${city} ${fmt.format(new Date())}`);
  draw();
  setInterval(draw, 20_000);
}
