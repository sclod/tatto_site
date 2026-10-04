import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base './' — чтобы сайт работал и на GitHub Pages (подпапка), и на любом хостинге.
// `--mode single` собирает всё в один HTML-файл (шрифты и 3D-модель внутри) —
// его можно просто открыть в браузере без сервера.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    outDir: mode === 'single' ? 'dist-single' : 'dist',
  },
}));
