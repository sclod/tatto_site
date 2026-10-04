import { flash, svgToUrl } from '../data/flash.js';
import { t as tr, lang } from '../i18n.js';
import { esc } from './esc.js';

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

const MAX_UPLOAD = 15 * 1024 * 1024;
const UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Интерфейс «бланка примерки». Сам 3D-модуль (three.js) грузится лениво.
// opts.zoom — разрешить зум колесом/щипком (на отдельной странице примерочной),
// opts.eager — грузить 3D сразу, не дожидаясь прокрутки.
export function tryOnUI(root, opts = {}) {
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const host = $('[data-tryon-canvas]');
  const stage = root.querySelector('.tryon__stage');
  // панель — это форма только ради семантики полей, отправлять её некуда
  $('[data-panel]')?.addEventListener('submit', (e) => e.preventDefault());
  stage.setAttribute('data-no-ink', '');
  const sheetNo = $('[data-sheet-no]');
  if (sheetNo) sheetNo.textContent = `№ ${String(Math.floor(Math.random() * 9000) + 1000)}`;

  let app = null;
  let booting = null;
  let lastDesign = designOf(flash[0]);

  // ——— статичная разметка панели ———
  $('[data-views]').innerHTML = VIEW_LIST.map(
    ([k, l]) => `<button type="button" role="radio" aria-checked="${k === 'arm'}" data-view="${k}">${l}</button>`,
  ).join('');
  $('[data-designs]').innerHTML = flash
    .map((f) => `<button type="button" data-design="${f.id}" title="${esc(f.title)}"><img src="${svgToUrl(f.svg, '#EEE8DC')}" alt="${esc(f.title)}" /></button>`)
    .join('');

  const render = (st) => {
    $$('[data-view]').forEach((b) => b.setAttribute('aria-checked', b.dataset.view === st.view));
    $$('[data-sex]').forEach((b) => b.setAttribute('aria-checked', b.dataset.sex === st.sex));
    $$('[data-skin]').forEach((b) => b.setAttribute('aria-checked', b.dataset.skin === st.skin));
    const t = st.selected;
    const fs = $('[data-needs-tattoo]');
    fs.disabled = !t;
    const cur = $('[data-current-title]');
    if (cur) cur.textContent = t ? (lang === 'en' ? `“${t.title}”` : `«${t.title}»`) : '';
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
            `<button type="button" role="radio" aria-label="${esc(s.label)}" title="${esc(s.label)}" data-skin="${s.id}" ${s.plaster ? 'data-plaster' : ''} style="background-color:${s.color}"></button>`,
        ).join('');
        return TryOn.create(host, { onChange: render, zoom: Boolean(opts.zoom) });
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
  if (opts.eager) boot();
  else new IntersectionObserver(
    ([e], obs) => {
      if (e.isIntersecting) {
        obs.disconnect();
        boot();
      }
    },
    { rootMargin: '100% 0px' },
  ).observe(root);

  const useDesign = async (d, addOpts = { replace: true }) => {
    lastDesign = d;
    const a = await boot();
    await a.addTattoo(d, addOpts);
  };

  // ——— события ———
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || !root.contains(b)) return;
    let a;
    try {
      a = await boot();
    } catch {
      return; // сообщение об ошибке уже показано на месте сцены
    }
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
  const hint = $('[data-upload-hint]');
  const takeFile = async (file) => {
    if (!file) return;
    // только растровые картинки разумного размера — без SVG и гигантских файлов
    if (!UPLOAD_TYPES.includes(file.type) || file.size > MAX_UPLOAD) {
      if (hint) hint.textContent = tr('uploadBad');
      return;
    }
    if (hint) hint.textContent = tr('uploadOk');
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 24) || tr('yourSketch');
    // декодируем сразу и держим саму картинку, а не blob-ссылку:
    // ссылку освобождаем, а «+ ще одне тату» потом берёт уже готовое изображение
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
      img.src = url;
      await img.decode();
    } catch {
      if (hint) hint.textContent = tr('uploadBad');
      return;
    } finally {
      URL.revokeObjectURL(url);
    }
    await useDesign({ img, title: name, size: 10, mono: false }).catch(() => {});
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
