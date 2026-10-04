import { flash, svgToUrl } from '../data/flash.js';
import { t as tr, lang } from '../i18n.js';

// ключи совпадают с VIEWS в tryon/scene.js
const VIEW_LIST = [
  ['full', tr('viewFull')],
  ['arm', tr('viewArm')],
  ['back', tr('viewBack')],
  ['chest', tr('viewChest')],
  ['leg', tr('viewLeg')],
  ['neck', tr('viewNeck')],
];

const designOf = (f) => ({ src: svgToUrl(f.svg, '#FFFFFF'), title: f.title, size: f.size, mono: f.mono });

// Интерфейс «бланка примерки». Сам 3D-модуль (three.js) грузится лениво.
export function tryOnUI(root) {
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const host = $('[data-tryon-canvas]');
  const stage = root.querySelector('.tryon__stage');
  stage.setAttribute('data-no-ink', '');
  $('[data-sheet-no]').textContent = `№ ${String(Math.floor(Math.random() * 9000) + 1000)}`;

  let app = null;
  let booting = null;
  let lastDesign = designOf(flash[0]);

  // ——— статичная разметка панели ———
  $('[data-views]').innerHTML = VIEW_LIST.map(
    ([k, l]) => `<button type="button" role="radio" aria-checked="${k === 'arm'}" data-view="${k}">${l}</button>`,
  ).join('');
  $('[data-designs]').innerHTML = flash
    .map((f) => `<button type="button" data-design="${f.id}" title="${f.title}"><img src="${svgToUrl(f.svg, '#EEE8DC')}" alt="${f.title}" /></button>`)
    .join('');

  const render = (st) => {
    $$('[data-view]').forEach((b) => b.setAttribute('aria-checked', b.dataset.view === st.view));
    $$('[data-sex]').forEach((b) => b.setAttribute('aria-checked', b.dataset.sex === st.sex));
    $$('[data-skin]').forEach((b) => b.setAttribute('aria-checked', b.dataset.skin === st.skin));
    const t = st.selected;
    const fs = $('[data-needs-tattoo]');
    fs.disabled = !t;
    $('[data-current-title]').textContent = t ? (lang === 'en' ? `“${t.title}”` : `«${t.title}»`) : '';
    if (!t) return;
    const size = $('[data-prop="sizeCm"]');
    const ang = $('[data-prop="angle"]');
    if (document.activeElement !== size) size.value = t.sizeCm;
    if (document.activeElement !== ang) ang.value = t.angle;
    $('[data-out="sizeCm"]').textContent = `${t.sizeCm} ${tr('cm')}`;
    $('[data-out="angle"]').textContent = `${t.angle}°`;
    $$('[data-set="mono"]').forEach((b) => b.setAttribute('aria-checked', String(t.mono) === b.dataset.val));
    $$('[data-set="state"]').forEach((b) => b.setAttribute('aria-checked', t.state === b.dataset.val));
  };

  async function boot() {
    if (app) return app;
    if (!booting) {
      booting = import('../tryon/scene.js').then(({ TryOn, SKINS }) => {
        $('[data-skins]').innerHTML = SKINS.map(
          (s) =>
            `<button type="button" role="radio" aria-label="${s.label}" title="${s.label}" data-skin="${s.id}" ${s.plaster ? 'data-plaster' : ''} style="background-color:${s.color}"></button>`,
        ).join('');
        return TryOn.create(host, { onChange: render });
      }).then((created) => {
        app = created;
        $('[data-tryon-loading]')?.remove();
        new IntersectionObserver(([e]) => app.setVisible(e.isIntersecting)).observe(stage);
        return app.addTattoo(lastDesign).then(() => app);
      }).catch((err) => {
        booting = null;
        const ph = $('[data-tryon-loading]');
        if (ph) ph.textContent = tr('loadFail');
        throw err;
      });
    }
    return booting;
  }

  // грузим 3D заранее, когда до примерочной остаётся ~экран
  new IntersectionObserver(
    ([e], obs) => {
      if (e.isIntersecting) {
        obs.disconnect();
        boot();
      }
    },
    { rootMargin: '100% 0px' },
  ).observe(root);

  const useDesign = async (d, opts = { replace: true }) => {
    lastDesign = d;
    const a = await boot();
    await a.addTattoo(d, opts);
  };

  // ——— события ———
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || !root.contains(b)) return;
    const a = await boot();
    const ds = b.dataset;
    if (ds.view) a.setView(ds.view);
    else if (ds.sex) a.setSex(ds.sex);
    else if (ds.design) useDesign(designOf(flash.find((f) => f.id === ds.design)));
    else if (ds.skin) {
      a.setSkin(ds.skin);
      a.emit();
    } else if (ds.set) a.update({ [ds.set]: ds.set === 'mono' ? ds.val === 'true' : ds.val });
    else if ('add' in ds) a.addTattoo(lastDesign);
    else if ('remove' in ds) a.removeSelected();
    else if (ds.zoom) a.zoomBy(+ds.zoom);
    else if ('reset' in ds) a.resetView();
    else if ('download' in ds) {
      const link = document.createElement('a');
      link.href = a.snapshot();
      link.download = tr('shotFile');
      link.click();
    } else if ('send' in ds) {
      const t = a.selected;
      window.dispatchEvent(
        new CustomEvent('tryon:shot', {
          detail: {
            img: a.snapshot(),
            title: t?.title,
            sizeCm: t?.sizeCm,
            zone: a.view === 'full' ? '' : VIEW_LIST.find(([k]) => k === a.view)?.[1],
          },
        }),
      );
    }
  });

  let raf = 0;
  $$('[data-prop]').forEach((input) =>
    input.addEventListener('input', () => {
      $(`[data-out="${input.dataset.prop}"]`).textContent = input.dataset.prop === 'sizeCm' ? `${input.value} ${tr('cm')}` : `${input.value}°`;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => app?.update({ [input.dataset.prop]: +input.value }));
    }),
  );

  // ——— загрузка своего эскиза ———
  const fileInput = $('[data-upload]');
  const drop = $('[data-drop]');
  const takeFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const name = file.name.replace(/\.[^.]+$/, '').slice(0, 24) || tr('yourSketch');
    useDesign({ src: URL.createObjectURL(file), title: name, size: 10, mono: false });
  };
  fileInput.addEventListener('change', () => takeFile(fileInput.files[0]));
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('is-over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    takeFile(e.dataTransfer.files[0]);
  });

  return {
    // вызывается из флеш-листа: «примерить →»
    tryFlash(id) {
      const f = flash.find((x) => x.id === id);
      if (f) useDesign(designOf(f));
    },
  };
}
