#!/usr/bin/env bash
# Обновление сайта на сервере:  bash deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
npm ci
npm run build
pm2 reload ecosystem.config.cjs --update-env
pm2 save
echo "Готово: $(git log -1 --format='%h %s')"
