# Деплой на свой VPS

Схема: **nginx** (HTTPS, сжатие, лимиты) → **Node.js-сервер** под **pm2** (`server/server.mjs`):
отдаёт собранный сайт из `dist/` и принимает заявки `POST /api/booking` → Telegram-бот.

```
посетитель ──https──▶ nginx :443 ──▶ 127.0.0.1:3000  node server/server.mjs (pm2)
                                         ├─ dist/  (сайт)
                                         └─ /api/booking ──▶ api.telegram.org
```

Нужно: VPS с **Ubuntu 22.04 / 24.04** (хватит 1 vCPU / 1 ГБ RAM), домен, Telegram-бот.
Ниже `example.com` — замени на свой домен.

---

## 1. Домен → сервер (DNS)

В панели регистратора домена добавь записи:

| Тип | Имя | Значение |
|---|---|---|
| A | `@` | IP твоего VPS |
| A | `www` | IP твоего VPS |
| AAAA | `@` и `www` | IPv6 VPS — только если он есть |

Проверка (может занять от минут до пары часов): `dig +short example.com` должен вернуть IP сервера.

## 2. Сервер: базовая подготовка

```bash
ssh root@IP_СЕРВЕРА

# обновления и файрвол: открыты только SSH, 80 и 443
apt update && apt upgrade -y
apt install -y git curl ufw
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# отдельный пользователь для сайта (не держим приложение под root)
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null
chown -R deploy:deploy /home/deploy/.ssh
passwd deploy            # пароль для sudo
```

## 3. Node.js 22 и pm2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2
node -v    # v22.x
```

## 4. Код сайта

Дальше — под пользователем `deploy`:

```bash
su - deploy
git clone https://github.com/sclod/tatto_site.git ~/valova
cd ~/valova
# пока изменения не влиты в main — работаем с этой веткой:
git checkout claude/bold-galileo-l6xk95
```

> Если репозиторий приватный — понадобится доступ: SSH-ключ сервера в
> GitHub → Settings → SSH keys (или deploy key в настройках репозитория),
> и клонировать по `git@github.com:sclod/tatto_site.git`.

## 5. Настройки и секреты (`.env`)

```bash
cp .env.example .env
nano .env
chmod 600 .env          # читать может только владелец
```

- `VITE_SITE_URL=https://example.com` — **без `www` и без слэша в конце**.
- `BOT_TOKEN=` — токен бота. **Выпусти новый** (старый светился в переписке):
  @BotFather → `/mybots` → бот → API Token → Revoke current token.
- `CHAT_ID=` — куда слать заявки:
  1. напиши своему боту в Telegram `/start` (или добавь его в группу и напиши там);
  2. `npm ci && npm run tg:chat-id` — скрипт покажет id, впиши его.

`.env` в git не попадает — это единственное место, где лежит токен.

## 6. Сборка и запуск в pm2

```bash
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save

curl http://127.0.0.1:3000/healthz     # → ok
```

Автозапуск после перезагрузки сервера:

```bash
pm2 startup systemd -u deploy --hp /home/deploy
# pm2 напечатает команду с sudo — скопируй и выполни её
```

## 7. nginx + HTTPS (Let's Encrypt)

Один скрипт: ставит nginx и certbot, выпускает бесплатный сертификат на домен и www,
включает HTTPS, редиректы http→https и www→без www, лимит частоты заявок,
автопродление сертификата.

```bash
sudo bash deploy/setup-nginx.sh example.com твой@email.com
```

Готово: открывай `https://example.com`.

## 8. Проверка

- Сайт открывается по `https://example.com`, `http://` и `www.` перекидывают туда же.
- Отправь тестовую заявку с сайта (и со снимком из примерочной) — она должна прийти в Telegram.
- Логи: `pm2 logs valova` (там видно `booking sent` или ошибку, токен в логи не пишется).
- Превью ссылки: отправь ссылку в Telegram. Если там старое превью —
  обнови его через бота @WebpageBot.

## 9. Обновление сайта

После новых коммитов (новые фото, тексты, правки):

```bash
cd ~/valova && bash deploy/update.sh
```

Скрипт делает `git pull` → `npm ci` → `npm run build` → `pm2 reload` (без простоя).

Если поменял `.env`:
- `BOT_TOKEN` / `CHAT_ID` → достаточно `pm2 reload valova --update-env`;
- `VITE_SITE_URL` → нужна пересборка: `npm run build && pm2 reload valova`.

## Если что-то не работает

| Симптом | Что проверить |
|---|---|
| 502 Bad Gateway | `pm2 status` — процесс `valova` должен быть `online`; `pm2 logs valova` |
| Сертификат не выпускается | DNS: `dig +short example.com` = IP сервера; открыт порт 80 (`ufw status`) |
| Заявки не приходят | `.env` заполнен; боту написали `/start`; `pm2 logs valova` (`booking failed: telegram` — неверный токен/CHAT_ID) |
| «Не вийшло надіслати» на сайте | то же + `VITE_SITE_URL` совпадает с адресом в браузере (без www, https) |
| После правок ничего не поменялось | `bash deploy/update.sh`; в браузере Ctrl+Shift+R |

## Безопасность сервера (желательно)

- Вход только по SSH-ключу: в `/etc/ssh/sshd_config` поставить `PasswordAuthentication no`
  и `PermitRootLogin no`, затем `sudo systemctl restart ssh` (сначала убедись, что вход по ключу работает).
- Автоустановка обновлений безопасности: `sudo apt install unattended-upgrades`.
- Бэкапить нечего, кроме `.env`: всё остальное лежит в git.

## Что где лежит

| Файл | Зачем |
|---|---|
| `server/server.mjs` | Node-сервер: статика (brotli/gzip, кэш, заголовки безопасности) + `/api/booking` + `/healthz` |
| `server/booking.mjs` | проверка заявки и отправка в Telegram |
| `ecosystem.config.cjs` | настройки pm2 (логи в `logs/`, перезапуск при падении) |
| `.env.example` | шаблон настроек и секретов |
| `deploy/setup-nginx.sh` | nginx + HTTPS одной командой |
| `deploy/nginx.conf.template` | конфиг nginx (скрипт подставляет домен) |
| `deploy/update.sh` | обновление сайта |
| `tools/tg-chat-id.mjs` | узнать CHAT_ID (`npm run tg:chat-id`) |
