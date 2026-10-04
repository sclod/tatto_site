#!/usr/bin/env bash
# Настройка nginx + бесплатный HTTPS-сертификат Let's Encrypt.
#   sudo bash deploy/setup-nginx.sh example.com you@mail.com
# Перед запуском: DNS домена (A-записи @ и www) уже указывают на IP сервера,
# а сайт запущен в pm2 (curl http://127.0.0.1:3000/healthz отвечает ok).
set -euo pipefail

DOMAIN="${1:?Укажи домен: sudo bash deploy/setup-nginx.sh example.com you@mail.com}"
EMAIL="${2:?Укажи email для Lets Encrypt — туда придут напоминания о сертификате}"
PORT="${PORT:-3000}"
DIR="$(cd "$(dirname "$0")" && pwd)"
SITE=/etc/nginx/sites-available/valova

if [[ $EUID -ne 0 ]]; then echo "Запусти через sudo"; exit 1; fi

apt-get update -qq
apt-get install -y -qq nginx certbot

mkdir -p /var/www/letsencrypt /etc/nginx/snippets
cp "$DIR/valova-proxy.conf" /etc/nginx/snippets/valova-proxy.conf

# 1) временный HTTP-конфиг — только чтобы Let's Encrypt проверил домен
cat > "$SITE" <<CONF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { proxy_pass http://127.0.0.1:$PORT; include /etc/nginx/snippets/valova-proxy.conf; }
}
CONF
ln -sf "$SITE" /etc/nginx/sites-enabled/valova
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 2) сертификат на домен и www
certbot certonly --webroot -w /var/www/letsencrypt -d "$DOMAIN" -d "www.$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email --non-interactive

# 3) полный конфиг с HTTPS
sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PORT__/$PORT/g" "$DIR/nginx.conf.template" > "$SITE"
nginx -t && systemctl reload nginx

# 4) после автопродления сертификата — перечитать его в nginx
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

echo "Готово: https://$DOMAIN"
