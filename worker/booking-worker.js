// Cloudflare Worker: принимает заявки с сайта и пересылает их в Telegram-бота.
//
// Токен бота живёт ТОЛЬКО в секретах воркера (BOT_TOKEN) — никогда в коде сайта
// или в репозитории: статический сайт видит любой посетитель.
//
// Переменные окружения (Settings → Variables and Secrets):
//   BOT_TOKEN       секрет: токен от @BotFather
//   CHAT_ID         секрет: id чата, куда слать заявки (см. worker/README.md)
//   ALLOWED_ORIGIN  обычная переменная: https://sclod.github.io (через запятую можно несколько)
// Необязательно: привязка Rate Limiting с именем LIMITER (см. wrangler.toml).

const MAX_BODY = 2_500_000; // ~2.5 МБ вместе с фото
const MAX_PHOTO = 1_800_000; // байт после декодирования
const LIMITS = { name: 80, contact: 120, idea: 1500, zone: 80, size: 20, when: 120, lang: 5, title: 80 };
const MIN_FILL_MS = 3000; // форму быстрее 3 секунд заполняют только боты

// запасной лимит, если привязка LIMITER не настроена: 5 заявок / 10 минут с одного IP
const memoryHits = new Map();
function memoryLimited(ip) {
  const now = Date.now();
  // не даём карте расти бесконечно: время от времени выкидываем старые записи
  if (memoryHits.size > 5000) {
    for (const [k, v] of memoryHits) if (!v.some((t) => now - t < 600_000)) memoryHits.delete(k);
  }
  const hits = (memoryHits.get(ip) || []).filter((t) => now - t < 600_000);
  hits.push(now);
  memoryHits.set(ip, hits);
  return hits.length > 5;
}

const LABELS = {
  uk: { head: '🆕 Нова заявка з сайту', name: 'Ім’я', contact: 'Контакт', idea: 'Ідея', zone: 'Зона', size: 'Розмір, см', when: 'Зручно', title: 'Ескіз' },
  en: { head: '🆕 New request from the site (EN)', name: 'Name', contact: 'Contact', idea: 'Idea', zone: 'Placement', size: 'Size, cm', when: 'Preferred', title: 'Sketch' },
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' });
    if (!allowed.includes(origin)) return reply(403, { ok: false, error: 'origin' });
    if (!env.BOT_TOKEN || !env.CHAT_ID) return reply(500, { ok: false, error: 'config' });
    if (!(request.headers.get('Content-Type') || '').includes('application/json')) return reply(415, { ok: false, error: 'type' });

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (env.LIMITER) {
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return reply(429, { ok: false, error: 'rate' });
    } else if (memoryLimited(ip)) {
      return reply(429, { ok: false, error: 'rate' });
    }

    // размер проверяем до чтения тела, чтобы огромный запрос не забил память воркера
    const declared = Number(request.headers.get('Content-Length') || 0);
    if (declared > MAX_BODY) return reply(413, { ok: false, error: 'size' });
    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply(413, { ok: false, error: 'size' });
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return reply(400, { ok: false, error: 'json' });
    }

    // ловушки для ботов: скрытое поле и слишком быстрое заполнение
    if (data.website) return reply(200, { ok: true });
    if (typeof data.elapsed === 'number' && data.elapsed < MIN_FILL_MS) return reply(200, { ok: true });

    const clean = {};
    for (const [key, max] of Object.entries(LIMITS)) {
      const v = typeof data[key] === 'string' ? data[key] : '';
      // убираем управляющие символы, обрезаем по длине
      clean[key] = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
    }
    if (!clean.name || !clean.contact || !clean.idea) return reply(422, { ok: false, error: 'required' });

    const L = LABELS[clean.lang] || LABELS.uk;
    const lines = [L.head, ''];
    for (const key of ['name', 'contact', 'idea', 'title', 'zone', 'size', 'when']) {
      if (clean[key]) lines.push(`${L[key]}: ${clean[key]}`);
    }
    const text = lines.join('\n');

    // фото из примерочной (jpeg/png data URL), если есть
    let photo = null;
    if (typeof data.image === 'string') {
      const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(data.image);
      if (m) {
        const bin = atob(m[2]);
        if (bin.length <= MAX_PHOTO) {
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          photo = new Blob([bytes], { type: `image/${m[1]}` });
        }
      }
    }

    const api = `https://api.telegram.org/bot${env.BOT_TOKEN}`;
    let res;
    if (photo && text.length <= 1024) {
      const form = new FormData();
      form.append('chat_id', env.CHAT_ID);
      form.append('caption', text); // без parse_mode — текст уходит как есть, без разметки
      form.append('photo', photo, 'try-on.jpg');
      res = await fetch(`${api}/sendPhoto`, { method: 'POST', body: form });
    } else {
      res = await fetch(`${api}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.CHAT_ID, text, disable_web_page_preview: true }),
      });
      if (res.ok && photo) {
        const form = new FormData();
        form.append('chat_id', env.CHAT_ID);
        form.append('photo', photo, 'try-on.jpg');
        await fetch(`${api}/sendPhoto`, { method: 'POST', body: form });
      }
    }

    // ответ Telegram наружу не отдаём — в нём может быть служебная информация
    if (!res.ok) return reply(502, { ok: false, error: 'telegram' });
    return reply(200, { ok: true });
  },
};
