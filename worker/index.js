// Cloudflare Worker сайта: статику (папку dist/) отдаёт сам Cloudflare,
// сюда попадают только запросы к /api/* (см. run_worker_first в wrangler.jsonc).
// POST /api/booking — заявка с сайта → сообщение в Telegram-бота.
// BOT_TOKEN и CHAT_ID — секреты воркера (Cloudflare → Worker → Settings → Variables and Secrets),
// в коде и в репозитории их нет.
import { sendBooking, rateLimiter, BookingError } from '../server/booking.mjs';

const MAX_BODY = 3 * 1024 * 1024;
// запасной лимит в памяти воркера; основной — привязка BOOKING_LIMIT (Cloudflare Rate Limiting)
const limited = rateLimiter({ limit: 5, windowMs: 10 * 60_000 });

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

async function booking(request, env) {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method' });
  // принимаем заявки только со своей страницы (тот же домен, что и запрос)
  if (request.headers.get('origin') !== new URL(request.url).origin) return json(403, { ok: false, error: 'origin' });
  if (!String(request.headers.get('content-type')).includes('application/json')) return json(415, { ok: false, error: 'type' });
  if (!env.BOT_TOKEN || !env.CHAT_ID) return json(503, { ok: false, error: 'config' });

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (env.BOOKING_LIMIT) {
    const { success } = await env.BOOKING_LIMIT.limit({ key: ip });
    if (!success) return json(429, { ok: false, error: 'rate' });
  }
  if (limited(ip)) return json(429, { ok: false, error: 'rate' });
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return json(413, { ok: false, error: 'size' });

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) throw new BookingError(413, 'size');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new BookingError(400, 'json');
    }
    const result = await sendBooking(data, { botToken: env.BOT_TOKEN, chatId: env.CHAT_ID, apiBase: env.TELEGRAM_API });
    console.log(`booking ${result}`);
    return json(200, { ok: true });
  } catch (err) {
    const status = err instanceof BookingError ? err.status : 502;
    // без токена и текста заявки: только код и ответ Telegram («chat not found», «Unauthorized»…)
    if (status >= 500) console.error(`booking failed: ${err.code || err.name}${err.detail ? ` (${err.detail})` : ''}`);
    return json(status, { ok: false, error: err.code || 'server' });
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/booking') return booking(request, env);
    if (pathname.startsWith('/api/')) return json(404, { ok: false, error: 'not_found' });
    return env.ASSETS.fetch(request);
  },
};
