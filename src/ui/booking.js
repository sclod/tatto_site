import { t, lang } from '../i18n.js';

// Заявка. Если задан site.bookingEndpoint (Cloudflare Worker, см. worker/README.md) —
// отправляем её в Telegram-бота. Иначе — запасной путь: копируем текст и открываем Direct.
// Токен бота на сайте не хранится и храниться не должен.
export function booking(form, site) {
  const shotBox = form.querySelector('[data-shot]');
  const shotImg = form.querySelector('[data-shot-img]');
  const status = form.querySelector('[data-book-status]');
  const submit = form.querySelector('[type="submit"]');
  const direct = form.querySelector('[data-direct]');
  const tg = form.querySelector('[data-telegram]');
  const endpoint = site.bookingEndpoint;
  const startedAt = Date.now();
  let shot = null;
  let title = '';

  const dm = `https://ig.me/m/${site.instagram}`;
  form.classList.toggle('has-bot', Boolean(endpoint));
  // без бота клиент и так пишет в Direct — поле контакта не нужно
  const contact = form.elements.contact;
  if (contact) {
    contact.required = Boolean(endpoint);
    contact.closest('label').hidden = !endpoint;
  }
  if (endpoint) {
    submit.textContent = t('submitBot');
    if (status) status.textContent = t('fineBot');
    if (direct) {
      direct.hidden = false;
      direct.href = dm;
    }
  }
  if (tg && site.telegram) {
    tg.hidden = false;
    tg.href = `https://t.me/${site.telegram}`;
    tg.addEventListener('click', () => copy(compose()));
  }

  window.addEventListener('tryon:shot', (e) => {
    const d = e.detail;
    shot = d.img;
    title = d.title || '';
    if (shotImg) shotImg.src = shot;
    if (shotBox) shotBox.hidden = false;
    if (d.zone && form.elements.zone && !form.elements.zone.value) form.elements.zone.value = d.zone.toLowerCase();
    if (d.sizeCm && form.elements.size) form.elements.size.value = d.sizeCm;
    if (d.title && !form.elements.idea.value) form.elements.idea.value = t('ideaFromShot', { title: d.title });
  });

  form.querySelector('[data-shot-remove]')?.addEventListener('click', () => {
    shot = null;
    shotBox.hidden = true;
  });

  const field = (n) => (form.elements[n] ? String(form.elements[n].value).trim() : '');

  const compose = () =>
    [
      t('msgHi', { name: field('name') || '…' }),
      t('msgIdea', { v: field('idea') || '—' }),
      field('zone') && t('msgZone', { v: field('zone') }),
      field('size') && t('msgSize', { v: field('size') }),
      field('when') && t('msgWhen', { v: field('when') }),
      shot && t('msgShot'),
    ]
      .filter(Boolean)
      .join('\n');

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  const SEND_TIMEOUT = 20_000;

  async function sendToBot() {
    const payload = {
      name: field('name'),
      contact: field('contact'),
      idea: field('idea'),
      zone: field('zone'),
      size: field('size'),
      when: field('when'),
      title,
      lang,
      image: shot || undefined,
      website: field('website'), // ловушка для ботов, у людей всегда пустая
      elapsed: Date.now() - startedAt,
    };
    // если сервер завис — не держим кнопку заблокированной вечно
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(String(res.status));
    } finally {
      clearTimeout(timer);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    if (!endpoint) {
      // копирование и открытие чата запускаем сразу, в том же нажатии:
      // Safari блокирует новые окна, открытые после ожидания
      const copied = copy(compose());
      if (shot) {
        const a = document.createElement('a');
        a.href = shot;
        a.download = t('shotFile');
        a.click();
      }
      window.open(dm, '_blank', 'noopener');
      status.textContent = (await copied) ? t('statusCopied') + (shot ? t('statusShot') : '.') : t('statusFail');
      return;
    }

    submit.disabled = true;
    status.textContent = t('sending');
    try {
      await sendToBot();
      status.textContent = t('sent');
      form.reset();
      shot = null;
      title = '';
      if (shotBox) shotBox.hidden = true;
      form.dispatchEvent(new CustomEvent('booking:sent', { bubbles: true }));
    } catch {
      status.textContent = t('sendFail');
    } finally {
      submit.disabled = false;
    }
  });
}
