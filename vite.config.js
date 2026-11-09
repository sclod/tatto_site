import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { BRAND, LOGO, HERO_NAME } from './src/data/brand.js';

// Cloudflare Web Analytics (статистика посещений без cookie): токен из Cloudflare →
// Analytics & Logs → Web Analytics → valova.space → «Manage site» → JS snippet, поле "token".
// Токен публичный (он всё равно виден в коде страницы). Пустая строка — счётчика нет.
const CF_BEACON_TOKEN = '';

// Политика безопасности контента (дублирует заголовок из public/_headers): скрипты, стили,
// шрифты и запросы — только к своему сайту (+ счётчик Cloudflare Web Analytics).
// В dev-сервере и однофайловой сборке не добавляется.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

// Адрес сайта подставляется в превью ссылок (og:*), canonical, sitemap и robots.
const siteFiles = (siteUrl) => ({
  name: 'site-files',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head' },
    ...(CF_BEACON_TOKEN
      ? [
          {
            tag: 'script',
            attrs: { defer: true, src: 'https://static.cloudflareinsights.com/beacon.min.js', 'data-cf-beacon': JSON.stringify({ token: CF_BEACON_TOKEN }) },
            injectTo: 'body',
          },
        ]
      : []),
  ],
  generateBundle() {
    const pages = ['', 'tryon'];
    const today = new Date().toISOString().slice(0, 10);
    this.emitFile({
      type: 'asset',
      fileName: 'sitemap.xml',
      source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${siteUrl}/${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`,
    });
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n` });
  },
});

// base './' — сайт работает и в корне домена, и в подпапке.
// `--mode single` собирает главную страницу в один HTML-файл для показа без сервера.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = (env.VITE_SITE_URL || 'https://valova.space').replace(/\/+$/, '');
  return {
    base: './',
    plugins: [
      // в index.html / tryon.html: %SITE_URL% → адрес сайта (VITE_SITE_URL, по умолчанию https://valova.space),
      // %BRAND%, %LOGO%, %HERO_NAME% → название, логотип и большая надпись из src/data/brand.js
      {
        name: 'site-vars',
        transformIndexHtml: {
          order: 'pre',
          handler: (html) =>
            html
              .replaceAll('%SITE_URL%', siteUrl)
              .replaceAll('%BRAND%', BRAND)
              .replaceAll('%LOGO%', LOGO)
              .replaceAll('%HERO_LABEL%', HERO_NAME.replaceAll('|', ''))
              .replaceAll('%HERO_NAME%', HERO_NAME),
        },
      },
      ...(single ? [viteSingleFile()] : [siteFiles(siteUrl)]),
    ],
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 900,
      outDir: single ? 'dist-single' : 'dist',
      rollupOptions: single
        ? undefined
        : { input: { main: resolve(import.meta.dirname, 'index.html'), tryon: resolve(import.meta.dirname, 'tryon.html') } },
    },
  };
});
