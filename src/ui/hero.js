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
    letters.forEach((l, i) => {
      if (pointer && !touch) {
        const r = l.el.getBoundingClientRect();
        const d = Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2));
        const fall = Math.max(260, innerWidth * 0.22);
        l.target = REST - 340 + 680 * Math.exp(-((d / fall) ** 2));
      } else {
        // без мыши — медленная волна
        l.target = REST + 300 * Math.sin(time / 900 - i * 0.7);
      }
      l.w += (l.target - l.w) * 0.12;
      l.el.style.fontVariationSettings = `'wght' ${l.w.toFixed(0)}`;
    });
  };
  requestAnimationFrame(tick);
  return letters.map((l) => l.el);
}

export function clock(el, tz, city) {
  const fmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: tz });
  const draw = () => (el.textContent = `${city} ${fmt.format(new Date())}`);
  draw();
  setInterval(draw, 20_000);
}
