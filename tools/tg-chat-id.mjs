// Показывает id чатов, которые писали боту, — чтобы вписать нужный в CHAT_ID.
//   1) напиши своему боту в Telegram /start (или добавь бота в группу и напиши там)
//   2) npm run tg:chat-id
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('Нет BOT_TOKEN: заполни .env (cp .env.example .env)');
  process.exit(1);
}
const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const data = await res.json();
if (!data.ok) {
  console.error('Telegram ответил ошибкой — проверь токен:', data.description);
  process.exit(1);
}
const chats = new Map();
for (const u of data.result) {
  const c = (u.message || u.channel_post || u.my_chat_member)?.chat;
  if (c) chats.set(c.id, c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || '');
}
if (!chats.size) console.log('Пусто. Напиши боту /start и запусти ещё раз.');
for (const [id, name] of chats) console.log(`CHAT_ID=${id}   # ${name}`);
