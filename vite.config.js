import { defineConfig } from 'vite';

// base './' — чтобы сайт работал и на GitHub Pages (подпапка), и на любом хостинге
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
