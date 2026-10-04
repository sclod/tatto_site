// Тексты-«заглушки», которые нужно заменить на реальные данные мастера.
// Поля вида { uk, en } — на двух языках (украинский основной).
export const site = {
  name: 'VALOVA',
  instagram: 'tattoo.by.valova',
  telegram: '', // например 'valova_tattoo' — появится кнопка Telegram
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
  { id: 1, title: { uk: 'Нічний метелик', en: 'Night moth' }, style: 'graphic', zone: { uk: 'передпліччя', en: 'forearm' }, size: 12, hours: 3, flash: 'moth' },
  { id: 2, title: { uk: 'Змія-оберіг', en: 'Guardian snake' }, style: 'color', zone: { uk: 'гомілка', en: 'shin' }, size: 18, hours: 5, flash: 'snake' },
  { id: 3, title: { uk: 'Польова квітка', en: 'Wildflower' }, style: 'fineline', zone: { uk: 'ключиця', en: 'collarbone' }, size: 8, hours: 2, flash: 'flower' },
  { id: 4, title: { uk: 'Око', en: 'The eye' }, style: 'graphic', zone: { uk: 'спина', en: 'back' }, size: 14, hours: 4, flash: 'eye' },
  { id: 5, title: { uk: 'Місяць', en: 'Moon' }, style: 'fineline', zone: { uk: 'зап’ястя', en: 'wrist' }, size: 6, hours: 1.5, flash: 'moon' },
  { id: 6, title: { uk: 'Назавжди', en: 'Forever' }, style: 'color', zone: { uk: 'плече', en: 'shoulder' }, size: 10, hours: 3, flash: 'heart' },
  { id: 7, title: { uk: 'Метелик II', en: 'Moth II' }, style: 'graphic', zone: { uk: 'стегно', en: 'thigh' }, size: 16, hours: 4, flash: 'moth' },
  { id: 8, title: { uk: 'Гілка', en: 'Branch' }, style: 'fineline', zone: { uk: 'ребра', en: 'ribs' }, size: 15, hours: 3, flash: 'flower' },
];
