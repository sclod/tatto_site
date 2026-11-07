// Перерисовывает картинку-превью ссылки (public/og.jpg, 1200×630) с текущим названием
// из src/data/brand.js. Запуск: npm run og-image (сам соберёт сайт до и после).
// Нужен Playwright с Chromium:  npm i -D playwright && npx playwright install chromium
import { preview } from 'vite';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    // можно и глобально установленный playwright
    try {
      const root = execSync('npm root -g').toString().trim();
      return createRequire(`${root}/`)('playwright').chromium;
    } catch {
      console.error('Нужен Playwright:  npm i -D playwright && npx playwright install chromium');
      process.exit(1);
    }
  }
}

const out = fileURLToPath(new URL('../public/og.jpg', import.meta.url));
const chromium = await loadChromium();
const server = await preview({ preview: { port: 4321, strictPort: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(4500); // интро-анимация и шрифты
// компактная раскладка первого экрана, чтобы всё влезло в 1200×630
await page.addStyleTag({
  content:
    '.nav,.hero__meta,.hero__foot,.hero__note{display:none!important}.hero{padding-top:28px;min-height:0;height:630px}.hero__top{margin:0 0 10px}.hero__name{margin-top:0}.hero__row{margin-top:18px}',
});
await page.waitForTimeout(300);
await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
await browser.close();
await new Promise((r) => server.httpServer.close(r));
console.log(`Готово: ${out}`);
