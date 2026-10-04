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
    if (d.title && !form.idea.value) form.idea.value = `Хочу «${d.title}» — примерил(а) на сайте`;
  });

  form.querySelector('[data-shot-remove]').addEventListener('click', () => {
    shot = null;
    shotBox.hidden = true;
  });

  const compose = () => {
    const f = new FormData(form);
    const lines = [
      `Привет! Меня зовут ${f.get('name') || '…'}.`,
      `Идея: ${f.get('idea') || '—'}`,
      f.get('zone') && `Зона: ${f.get('zone')}`,
      f.get('size') && `Размер: ~${f.get('size')} см`,
      f.get('when') && `Удобно: ${f.get('when')}`,
      shot && '(прикладываю снимок из примерочной)',
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
      a.download = 'valova-primerka.jpg';
      a.click();
    }
    status.textContent = ok
      ? 'Текст скопирован ✓ Вставь его в открывшийся чат' + (shot ? ' и приложи скачанный снимок.' : '.')
      : 'Открываем чат — напиши идею, зону и размер.';
    window.open(`https://ig.me/m/${site.instagram}`, '_blank', 'noopener');
  });
}
