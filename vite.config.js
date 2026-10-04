import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Политика безопасности контента: страница может загружать скрипты, стили и
// шрифты только с собственного адреса, отправлять данные только по https,
// не может быть встроена в формы на чужие сайты и т.п.
// Добавляется только в обычную сборку: в dev-сервере и в однофайловой сборке
// (там всё встроено inline) она бы мешала.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = () => ({
  name: 'security-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head' },
  ],
});

// base './' — чтобы сайт работал и на GitHub Pages (подпапка), и на любом хостинге.
// `--mode single` собирает главную страницу в один HTML-файл (шрифты и 3D-модель внутри) —
// его можно просто открыть в браузере без сервера.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: single ? [viteSingleFile()] : [securityHeaders()],
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
