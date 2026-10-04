// Продакшен-сервер сайта: отдаёт собранную папку dist/ и принимает заявки (/api/booking).
// Без внешних зависимостей. Запуск: `npm start` или через pm2 (ecosystem.config.cjs).
// Настройки — переменные окружения из .env (см. .env.example).

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync, constants as zc } from 'node:zlib';
import { createHash } from 'node:crypto';
import { sendBooking, rateLimiter, BookingError } from './booking.mjs';

const env = process.env;
const PORT = Number(env.PORT || 3000);
const HOST = env.HOST || '127.0.0.1'; // наружу смотрит nginx, сам сервер — только локально
const TRUST_PROXY = env.TRUST_PROXY !== '0'; // за nginx реальный IP приходит в X-Forwarded-For
const SITE_URL = env.SITE_URL || env.VITE_SITE_URL;
const SITE_ORIGIN = SITE_URL ? new URL(SITE_URL).origin : null;
const ROOT = fileURLToPath(new URL('../dist/', import.meta.url));
const MAX_BODY = 3 * 1024 * 1024;

if (!env.BOT_TOKEN || !env.CHAT_ID) {
  console.warn('[valova] BOT_TOKEN/CHAT_ID не заданы — заявки с сайта отправляться не будут (см. .env.example)');
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml', '.bin', '.webmanifest']);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// ——— статика: файлы читаются один раз и держатся в памяти уже сжатыми ———
const cache = new Map();

async function loadFile(path) {
  if (cache.has(path)) return cache.get(path);
  const body = await readFile(path);
  const ext = extname(path).toLowerCase();
  const entry = {
    body,
    type: TYPES[ext] || 'application/octet-stream',
    etag: `"${createHash('sha1').update(body).digest('base64url').slice(0, 20)}"`,
    // хэшированные файлы сборки (assets/*) не меняются — кэшируем на год
    cacheControl: path.includes(`${sep}assets${sep}`)
      ? 'public, max-age=31536000, immutable'
      : ext === '.html'
        ? 'no-cache'
        : 'public, max-age=86400',
  };
  if (COMPRESSIBLE.has(ext) && body.length > 1024) {
    entry.br = brotliCompressSync(body, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } });
    entry.gz = gzipSync(body, { level: 9 });
  }
  cache.set(path, entry);
  return entry;
}

async function resolvePath(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (p.includes('\0')) return null;
  if (p.endsWith('/')) p += 'index.html';
  const full = normalize(join(ROOT, p));
  if (!full.startsWith(ROOT)) return null; // попытка выйти за пределы dist/
  for (const candidate of [full, `${full}.html`]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      /* нет такого файла */
    }
  }
  return null;
}

async function serveStatic(req, res, urlPath) {
  const path = await resolvePath(urlPath);
  const status = path ? 200 : 404;
  const file = await loadFile(path || join(ROOT, '404.html')).catch(() => null);
  if (!file) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });

  const headers = { 'Content-Type': file.type, 'Cache-Control': status === 200 ? file.cacheControl : 'no-cache', ETag: file.etag, Vary: 'Accept-Encoding' };
  if (status === 200 && req.headers['if-none-match'] === file.etag) return send(res, 304, null, headers);

  const accept = String(req.headers['accept-encoding'] || '');
  let body = file.body;
  if (file.br && /\bbr\b/.test(accept)) {
    body = file.br;
    headers['Content-Encoding'] = 'br';
  } else if (file.gz && /\bgzip\b/.test(accept)) {
    body = file.gz;
    headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = body.length;
  send(res, status, req.method === 'HEAD' ? null : body, headers);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body ?? undefined);
}

const json = (res, status, obj) =>
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });

// ——— заявки ———
const limited = rateLimiter({ limit: 5, windowMs: 10 * 60_000 });

const clientIp = (req) =>
  (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_BODY) return reject(new BookingError(413, 'size'));
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new BookingError(413, 'size'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleBooking(req, res) {
  // принимаем заявки только со своей страницы
  const origin = req.headers.origin;
  const proto = TRUST_PROXY ? String(req.headers['x-forwarded-proto'] || 'http').split(',')[0] : 'http';
  const expected = SITE_ORIGIN || `${proto}://${req.headers.host}`;
  if (!origin || origin !== expected) return json(res, 403, { ok: false, error: 'origin' });
  if (!String(req.headers['content-type'] || '').includes('application/json')) return json(res, 415, { ok: false, error: 'type' });
  if (!env.BOT_TOKEN || !env.CHAT_ID) return json(res, 503, { ok: false, error: 'config' });
  if (limited(clientIp(req))) return json(res, 429, { ok: false, error: 'rate' });

  try {
    const raw = await readBody(req);
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new BookingError(400, 'json');
    }
    const result = await sendBooking(data, { botToken: env.BOT_TOKEN, chatId: env.CHAT_ID });
    console.log(`[valova] ${new Date().toISOString()} booking ${result}`);
    json(res, 200, { ok: true });
  } catch (err) {
    const status = err instanceof BookingError ? err.status : 502;
    if (status >= 500) console.error(`[valova] booking failed: ${err.code || err.name}`);
    if (!res.headersSent) json(res, status, { ok: false, error: err.code || 'server' });
  }
}

// ——— роутинг ———
const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api/booking') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method' });
      return await handleBooking(req, res);
    }
    if (pathname === '/healthz') return send(res, 200, 'ok', { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[valova] request error', err);
    if (!res.headersSent) send(res, 500, 'Server error', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
});

server.keepAliveTimeout = 65_000; // дольше, чем keepalive у nginx
server.listen(PORT, HOST, () => {
  console.log(`[valova] http://${HOST}:${PORT} · dist: ${ROOT}`);
  process.send?.('ready'); // pm2 wait_ready
});

// аккуратная остановка при pm2 reload/stop
const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
