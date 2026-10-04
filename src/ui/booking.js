import { t } from '../i18n.js';

// Заявка без бэкенда: собираем текст, копируем и открываем Direct / Telegram.
export function booking(form, site) {
  const shotBox = form.querySelector('[data-shot]');
  const shotImg = form.querySelector('[data-shot-img]');
  const status = form.querySelector('[data-book-status]');
  const tg = form.querySelector('[data-telegram]');
  let shot = null;

  if (site.telegram) {
    tg.hidden = false;
    tg.href = `https://t.me/${site.telegram}`;
    tg.addEventListener('click', () => copy(compose()));
  }

  window.addEventListener('tryon:shot', (e) => {
    const d = e.detail;
    shot = d.img;
    shotImg.src = shot;
    shotBox.hidden = false;
    if (d.zone && !form.zone.value) form.zone.value = d.zone.toLowerCase();
    if (d.sizeCm) form.size.value = d.sizeCm;
    if (d.title && !form.idea.value) form.idea.value = t('ideaFromShot', { title: d.title });
  });

  form.querySelector('[data-shot-remove]').addEventListener('click', () => {
    shot = null;
    shotBox.hidden = true;
  });

  const compose = () => {
    const f = new FormData(form);
    const lines = [
      t('msgHi', { name: f.get('name') || '…' }),
      t('msgIdea', { v: f.get('idea') || '—' }),
      f.get('zone') && t('msgZone', { v: f.get('zone') }),
      f.get('size') && t('msgSize', { v: f.get('size') }),
      f.get('when') && t('msgWhen', { v: f.get('when') }),
      shot && t('msgShot'),
    ];
    return lines.filter(Boolean).join('\n');
  };

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await copy(compose());
    if (shot) {
      const a = document.createElement('a');
      a.href = shot;
      a.download = t('shotFile');
      a.click();
    }
    status.textContent = ok ? t('statusCopied') + (shot ? t('statusShot') : '.') : t('statusFail');
    window.open(`https://ig.me/m/${site.instagram}`, '_blank', 'noopener');
  });
}
