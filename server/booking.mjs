// Заявка с сайта → сообщение в Telegram-бота.
// Токен бота берётся только из окружения сервера (.env), в браузер он не попадает.

const LIMITS = { name: 80, contact: 120, idea: 1500, zone: 80, size: 20, when: 120, lang: 5, title: 80 };
const MAX_PHOTO = 1_800_000; // байт после декодирования
const MIN_FILL_MS = 3000; // форму быстрее 3 секунд заполняют только боты
const TELEGRAM_TIMEOUT = 15_000;

const LABELS = {
  uk: { head: '🆕 Нова заявка з сайту', name: 'Ім’я', contact: 'Контакт', idea: 'Ідея', zone: 'Зона', size: 'Розмір, см', when: 'Зручно', title: 'Ескіз' },
  en: { head: '🆕 New request from the site (EN)', name: 'Name', contact: 'Contact', idea: 'Idea', zone: 'Placement', size: 'Size, cm', when: 'Preferred', title: 'Sketch' },
};

/** Ошибка с HTTP-статусом и коротким кодом для ответа клиенту. */
export class BookingError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

// убираем управляющие символы, обрезаем по длине
const clean = (v, max) =>
  (typeof v === 'string' ? v : '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);

/**
 * Проверяет заявку и отправляет её в Telegram.
 * @returns {Promise<'sent'|'ignored'>} 'ignored' — сработала ловушка для ботов (клиенту отвечаем «ок»)
 */
export async function sendBooking(data, { botToken, chatId }) {
  if (!data || typeof data !== 'object') throw new BookingError(400, 'json');

  // ловушки для ботов: скрытое поле и слишком быстрое заполнение
  if (data.website) return 'ignored';
  if (typeof data.elapsed === 'number' && data.elapsed < MIN_FILL_MS) return 'ignored';

  const f = Object.fromEntries(Object.entries(LIMITS).map(([k, max]) => [k, clean(data[k], max)]));
  if (!f.name || !f.contact || !f.idea) throw new BookingError(422, 'required');

  const L = LABELS[f.lang] || LABELS.uk;
  const lines = [L.head, ''];
  for (const key of ['name', 'contact', 'idea', 'title', 'zone', 'size', 'when']) {
    if (f[key]) lines.push(`${L[key]}: ${f[key]}`);
  }
  const text = lines.join('\n');

  // снимок из примерочной (jpeg/png data URL), если есть
  let photo = null;
  if (typeof data.image === 'string') {
    const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(data.image);
    if (m) {
      const bytes = Buffer.from(m[2], 'base64');
      if (bytes.length <= MAX_PHOTO) photo = new Blob([bytes], { type: `image/${m[1]}` });
    }
  }

  // TELEGRAM_API можно переопределить только для тестов (поддельный Telegram)
  const api = `${process.env.TELEGRAM_API || 'https://api.telegram.org'}/bot${botToken}`;
  const call = (method, body) =>
    fetch(`${api}/${method}`, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT),
    });

  let res;
  if (photo && text.length <= 1024) {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', text); // без parse_mode — текст уходит как есть, без разметки
    form.append('photo', photo, 'try-on.jpg');
    res = await call('sendPhoto', form);
  } else {
    res = await call('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } });
    if (res.ok && photo) {
      const p = new FormData();
      p.append('chat_id', chatId);
      p.append('photo', photo, 'try-on.jpg');
      await call('sendPhoto', p).catch(() => {});
    }
  }
  // ответ Telegram наружу не отдаём — в нём может быть служебная информация
  if (!res.ok) throw new BookingError(502, 'telegram');
  return 'sent';
}

/** Простой лимит частоты в памяти процесса: N запросов за окно на один IP. */
export function rateLimiter({ limit = 5, windowMs = 10 * 60_000 } = {}) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    }
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(key, list);
    return list.length > limit;
  };
}
