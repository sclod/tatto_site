// Курсор как игла: оставляет тонкий чернильный след, который «впитывается» в бумагу.
export function inkTrail(canvas) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || matchMedia('(pointer: coarse)').matches) {
    canvas.remove();
    return;
  }
  const ctx = canvas.getContext('2d');
  const LIFE = 1100;
  const pts = [];
  let dpr = 1;
  let last = null;
  let running = false;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();
  addEventListener('resize', resize);

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const blocked = e.target.closest?.('[data-no-ink], input, textarea, .lightbox');
      const now = performance.now();
      if (blocked) {
        last = null;
        return;
      }
      const p = { x: e.clientX, y: e.clientY, t: now, w: 2.6, brk: !last || now - last.t > 80 };
      if (last && !p.brk) {
        const v = Math.hypot(p.x - last.x, p.y - last.y) / Math.max(1, now - last.t);
        // быстрое движение — тонкая линия, медленное — жирнее, как у пера
        p.w = Math.max(0.5, Math.min(3.2, 3.4 - v * 1.4));
        p.w = last.w * 0.6 + p.w * 0.4;
      }
      pts.push(p);
      last = p;
      if (!running) {
        running = true;
        requestAnimationFrame(draw);
      }
    },
    { passive: true },
  );

  function draw() {
    const now = performance.now();
    while (pts.length && now - pts[0].t > LIFE) pts.shift();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (b.brk) continue;
      const k = 1 - (now - b.t) / LIFE;
      ctx.strokeStyle = `rgba(22, 21, 27, ${(k * 0.8).toFixed(3)})`;
      ctx.lineWidth = b.w * (0.35 + 0.65 * k);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    if (pts.length) requestAnimationFrame(draw);
    else {
      running = false;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
  }
}
