// Все тексты-«заглушки», которые нужно заменить на реальные данные мастера.
export const site = {
  name: 'VALOVA',
  instagram: 'tattoo.by.valova',
  telegram: '', // например 'valova_tattoo' — появится кнопка Telegram
  city: 'Город',
  studio: 'Студия · адрес по записи',
  timezone: 'Europe/Moscow',
  bookingMonth: 'запись открыта',
};

// Работы для «Каталога образцов». Когда появятся фото — кладите их в public/works/
// и указывайте `img: 'works/01.jpg'`. Пока img нет, показывается эскиз-заглушка.
export const works = [
  { id: 1, title: 'Ночной мотылёк', style: 'графика', zone: 'предплечье', size: 12, hours: 3, flash: 'moth' },
  { id: 2, title: 'Змея-оберег', style: 'цвет', zone: 'голень', size: 18, hours: 5, flash: 'snake' },
  { id: 3, title: 'Полевой цветок', style: 'fine line', zone: 'ключица', size: 8, hours: 2, flash: 'flower' },
  { id: 4, title: 'Око', style: 'графика', zone: 'спина', size: 14, hours: 4, flash: 'eye' },
  { id: 5, title: 'Луна', style: 'fine line', zone: 'запястье', size: 6, hours: 1.5, flash: 'moon' },
  { id: 6, title: 'Навсегда', style: 'цвет', zone: 'плечо', size: 10, hours: 3, flash: 'heart' },
  { id: 7, title: 'Мотылёк II', style: 'графика', zone: 'бедро', size: 16, hours: 4, flash: 'moth' },
  { id: 8, title: 'Ветка', style: 'fine line', zone: 'рёбра', size: 15, hours: 3, flash: 'flower' },
];
