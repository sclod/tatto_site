// Буквы имени «набухают» рядом с курсором — вариативная жирность Unbounded (200–900).
export function weightLetters(el) {
  const raw = el.textContent.trim().replace(/\s+/g, ' ');
  el.textContent = '';
  // на телефоне надпись переносится в две строки (так она крупнее): там, где стоит «|»,
  // иначе по пробелу, ближайшему к середине; одно слово без «|» остаётся в строку
  const mark = raw.indexOf('|');
  const text = raw.replaceAll('|', '');
  const spaces = [...text].flatMap((ch, i) => (ch === ' ' ? [i] : []));
  const nearMiddle = (a, b) => Math.abs(a - text.length / 2) - Math.abs(b - text.length / 2);
  const cut = mark > 0 ? -1 : (spaces.sort(nearMiddle)[0] ?? -1);
  const letters = [...text].map((ch, i) => {
    if (i === mark) el.insertAdjacentHTML('beforeend', '<i class="hero__br" aria-hidden="true"></i>');
    const s = document.createElement('span');
    s.textContent = ch === ' ' ? '\u00a0' : ch;
    s.setAttribute('aria-hidden', 'true');
    if (i === cut) s.className = 'hero__sp';
    el.appendChild(s);
    if (i === cut) el.insertAdjacentHTML('beforeend', '<i class="hero__br" aria-hidden="true"></i>');
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

// Название растягивается на ширину строки при любой длине (src/data/brand.js).
// Меряем при самом жирном начертании, до которого доходит анимация (900), —
// так буквы никогда не вылезут за край экрана.
export function fitName(el, maxPx = 380) {
  const h1 = el.parentElement;
  const spans = [...el.querySelectorAll('span')];
  const br = el.querySelector('.hero__br');
  const fit = () => {
    const prev = spans.map((s) => s.style.fontVariationSettings);
    h1.style.fontSize = '100px';
    spans.forEach((s) => (s.style.fontVariationSettings = "'wght' 900"));
    // на телефоне название в две строки — равняемся на самую длинную
    const cut = br && getComputedStyle(br).display !== 'none' ? spans.indexOf(br.nextElementSibling) : -1;
    const lines = cut > 0 ? [spans.slice(0, cut), spans.slice(cut)] : [spans];
    const widest = Math.max(...lines.map((l) => l.reduce((w, s) => w + s.getBoundingClientRect().width, 0)));
    const size = Math.min(maxPx, (100 * h1.getBoundingClientRect().width * 0.99) / widest);
    spans.forEach((s, i) => (s.style.fontVariationSettings = prev[i]));
    h1.style.fontSize = `${size.toFixed(1)}px`;
  };
  fit();
  document.fonts.ready.then(fit);
  let raf = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(fit);
  });
}
