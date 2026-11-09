// Тексты-«заглушки», которые нужно заменить на реальные данные мастера.
// Поля вида { uk, en } — на двух языках (украинский основной).
import { BRAND } from './brand.js';

export const site = {
  name: BRAND, // само название — в src/data/brand.js
  instagram: 'tattoo.by.valova',
  telegram: '', // ник в Telegram без @, например 'my_tattoo' — появится кнопка Telegram
  city: { uk: 'Місто', en: 'City' },
  studio: { uk: 'Студія · адреса за записом', en: 'Studio · address on booking' },
  timezone: 'Europe/Kyiv',
  // Флеш-лист (свободные эскизы). false — секция и пункт меню скрыты, номера секций идут подряд.
  // В 3D-примерочной эскизы-образцы остаются. Включить обратно: true.
  showFlash: false,
  // Куда отправлять заявки: /api/booking — воркер Cloudflare (worker/index.js) шлёт их в Telegram.
  // Пустая строка (VITE_BOOKING_ENDPOINT=) — заявка копируется и открывается Direct (для статических хостингов).
  // ТОКЕН БОТА СЮДА НЕ ПИСАТЬ — он хранится только в секретах GitHub/Cloudflare.
  bookingEndpoint: import.meta.env.VITE_BOOKING_ENDPOINT ?? 'api/booking',
};

// Работы для «Каталога образцов»: фото в public/works/ (кадр 4:5, WebP ~1000×1250).
// style — ключ стиля из src/i18n.js: graphic | color | fineline.
// size (см) и hours (часы) — по желанию: если не указаны, в карточке не показываются.
// Без img показывается эскиз-заглушка из флеш-листа: flash: 'luna'.
export const works = [
  { id: 1, img: 'works/07.webp', title: { uk: 'Маска оні', en: 'Oni mask' }, style: 'color', zone: { uk: 'передпліччя', en: 'forearm' } },
  { id: 2, img: 'works/06.webp', title: { uk: 'Венера і змія', en: 'Venus and the snake' }, style: 'graphic', zone: { uk: 'передпліччя', en: 'forearm' } },
  { id: 3, img: 'works/01.webp', title: { uk: 'Сюрреаліст', en: 'The surrealist' }, style: 'graphic', zone: { uk: 'передпліччя', en: 'forearm' } },
  { id: 4, img: 'works/03.webp', title: { uk: 'Півонії', en: 'Peonies' }, style: 'fineline', zone: { uk: 'передпліччя', en: 'forearm' } },
  { id: 5, img: 'works/09.webp', title: { uk: 'Ліхтар', en: 'Lantern' }, style: 'graphic', zone: { uk: 'плече', en: 'shoulder' } },
  { id: 6, img: 'works/05.webp', title: { uk: 'Місяць і орнамент', en: 'Moon ornament' }, style: 'fineline', zone: { uk: 'кисть', en: 'hand' } },
  { id: 7, img: 'works/08.webp', title: { uk: 'Троянда і годинник', en: 'Rose and clock' }, style: 'graphic', zone: { uk: 'кисть', en: 'hand' } },
  { id: 8, img: 'works/02.webp', title: { uk: 'Квіти й маска', en: 'Flowers and mask' }, style: 'graphic', zone: { uk: 'передпліччя', en: 'forearm' } },
  { id: 9, img: 'works/04.webp', title: { uk: 'Риби', en: 'Pisces' }, style: 'fineline', zone: { uk: 'ключиця', en: 'collarbone' } },
  { id: 10, img: 'works/10.webp', title: { uk: 'Сузір’я', en: 'Constellation' }, style: 'fineline', zone: { uk: 'ключиця', en: 'collarbone' } },
];
