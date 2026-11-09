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
  // Куда отправлять заявки. На своём сервере это /api/booking (server/server.mjs шлёт их в Telegram).
  // Пустая строка (VITE_BOOKING_ENDPOINT=) — заявка копируется и открывается Direct (для статических хостингов).
  // ТОКЕН БОТА СЮДА НЕ ПИСАТЬ — он хранится только в .env на сервере.
  bookingEndpoint: import.meta.env.VITE_BOOKING_ENDPOINT ?? 'api/booking',
};

// Работы для «Каталога образцов». Когда появятся фото — кладите их в public/works/
// и указывайте `img: 'works/01.jpg'`. Пока img нет, показывается эскиз-заглушка.
// style — ключ стиля из src/i18n.js: graphic | color | fineline.
export const works = [
  { id: 1, title: { uk: 'Місячний метелик', en: 'Luna moth' }, style: 'graphic', zone: { uk: 'передпліччя', en: 'forearm' }, size: 12, hours: 3, flash: 'luna' },
  { id: 2, title: { uk: 'Змія і кинджал', en: 'Snake & dagger' }, style: 'color', zone: { uk: 'гомілка', en: 'shin' }, size: 18, hours: 5, flash: 'dagger' },
  { id: 3, title: { uk: 'Бант і рябчики', en: 'Bow & fritillaries' }, style: 'fineline', zone: { uk: 'ключиця', en: 'collarbone' }, size: 10, hours: 2.5, flash: 'bow' },
  { id: 4, title: { uk: 'Кібер-сигіл', en: 'Cyber sigil' }, style: 'graphic', zone: { uk: 'хребет', en: 'spine' }, size: 24, hours: 4, flash: 'sigil' },
  { id: 5, title: { uk: 'Орнамент-люстра', en: 'Chandelier ornament' }, style: 'fineline', zone: { uk: 'грудина', en: 'sternum' }, size: 15, hours: 4, flash: 'sternum' },
  { id: 6, title: { uk: 'Восьминіг', en: 'Octopus' }, style: 'graphic', zone: { uk: 'стегно', en: 'thigh' }, size: 16, hours: 5, flash: 'octopus' },
  { id: 7, title: { uk: 'Сигіл II', en: 'Sigil II' }, style: 'graphic', zone: { uk: 'передпліччя', en: 'forearm' }, size: 14, hours: 3, flash: 'sigil' },
  { id: 8, title: { uk: 'Метелик II', en: 'Moth II' }, style: 'fineline', zone: { uk: 'ребра', en: 'ribs' }, size: 13, hours: 3, flash: 'luna' },
];
