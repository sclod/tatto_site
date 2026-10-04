import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Политика безопасности контента (дублирует заголовок сервера — нужна для статических
// хостингов вроде GitHub Pages, где заголовки не настроить): скрипты, стили, шрифты
// и запросы — только к своему сайту. В dev-сервере и однофайловой сборке не добавляется.
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
  'upgrade-insecure-requests',
].join('; ');

// Адрес сайта подставляется в превью ссылок (og:*), canonical, sitemap и robots.
const siteFiles = (siteUrl) => ({
  name: 'site-files',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head' },
  ],
  generateBundle() {
    const pages = ['', 'tryon.html'];
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

// base './' — сайт работает и в корне домена, и в подпапке (GitHub Pages).
// `--mode single` собирает главную страницу в один HTML-файл для показа без сервера.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = (env.VITE_SITE_URL || 'https://example.com').replace(/\/+$/, '');
  return {
    base: './',
    plugins: [
      // %SITE_URL% в index.html / tryon.html → адрес сайта из .env (VITE_SITE_URL)
      { name: 'site-url', transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', siteUrl) } },
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
