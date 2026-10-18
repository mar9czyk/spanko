#!/usr/bin/env bash
# Lokalny build Next.js (standalone) i wysyłka na VPS Mikr.us przez SSH.
# Konfiguracja: scripts/deploy.env (patrz scripts/deploy.env.example).
# Wymaga: .env.production.local z NEXT_PUBLIC_POCKETBASE_URL (wbudowywane w czasie builda).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

fail() {
  echo "❌ $*" >&2
  exit 1
}

CONFIG_FILE="scripts/deploy.env"
[ -f "$CONFIG_FILE" ] || fail "Brak $CONFIG_FILE — skopiuj scripts/deploy.env.example i uzupełnij."
# shellcheck disable=SC1090
source "$CONFIG_FILE"

for var in MIKRUS_USER MIKRUS_HOST MIKRUS_PORT REMOTE_DIR APP_URL; do
  [ -n "${!var:-}" ] || fail "Zmienna $var nie jest ustawiona w $CONFIG_FILE."
done
REMOTE_SERVICE_USER="${REMOTE_SERVICE_USER:-spanko}"
APP_URL="${APP_URL%/}"

if [ ! -f .env.production.local ] || ! grep -q '^NEXT_PUBLIC_POCKETBASE_URL=.\+' .env.production.local; then
  fail "Brak .env.production.local z NEXT_PUBLIC_POCKETBASE_URL (np. https://domena/pb). \
Zmienne NEXT_PUBLIC_* są wbudowywane w czasie builda — wzór: deploy/mikrus/.env.production.local.example"
fi

SSH_TARGET="${MIKRUS_USER}@${MIKRUS_HOST}"
SSH_CMD=(ssh -p "$MIKRUS_PORT")

echo "🔍 1/5: Weryfikacja typów, lintów (Biome) i testów (Vitest)..."
pnpm check
pnpm test

echo "🏗️  2/5: Budowanie paczki produkcyjnej Next.js Standalone lokalnie..."
pnpm build
[ -f .next/standalone/server.js ] || fail "Brak .next/standalone/server.js po buildzie."

echo "📦 3/5: Przygotowanie struktury standalone..."
rm -rf .next/standalone/public .next/standalone/.next/static
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
# Sekrety nigdy nie jadą w paczce
find .next/standalone -maxdepth 1 -name '.env*' -delete

echo "🚀 4/5: Przesyłanie paczki na ${SSH_TARGET}:${REMOTE_DIR} ..."
if command -v rsync >/dev/null 2>&1; then
  # -L: rozwiązuje symlinki pnpm w node_modules standalone
  rsync -azL --delete --exclude '.env.production' \
    -e "ssh -p ${MIKRUS_PORT}" \
    .next/standalone/ "${SSH_TARGET}:${REMOTE_DIR}/"
else
  echo "ℹ️  Brak rsync (Git Bash na Windows) — używam tar po SSH z atomową zamianą katalogów."
  NEW_DIR="${REMOTE_DIR}.new"
  OLD_DIR="${REMOTE_DIR}.old"
  # -h: rozwiązuje symlinki pnpm
  tar -chzf - -C .next/standalone . |
    "${SSH_CMD[@]}" "$SSH_TARGET" "rm -rf '${NEW_DIR}' && mkdir -p '${NEW_DIR}' && tar -xzf - -C '${NEW_DIR}'"
  "${SSH_CMD[@]}" "$SSH_TARGET" "set -e
    if [ -f '${REMOTE_DIR}/.env.production' ]; then cp '${REMOTE_DIR}/.env.production' '${NEW_DIR}/.env.production'; fi
    rm -rf '${OLD_DIR}'
    if [ -d '${REMOTE_DIR}' ]; then mv '${REMOTE_DIR}' '${OLD_DIR}'; fi
    mv '${NEW_DIR}' '${REMOTE_DIR}'"
fi

echo "🔄 5/5: Restart usługi spanko-web i healthcheck..."
"${SSH_CMD[@]}" "$SSH_TARGET" "chown -R ${REMOTE_SERVICE_USER}:${REMOTE_SERVICE_USER} '${REMOTE_DIR}' \
  && systemctl restart spanko-web && systemctl is-active spanko-web"

CURL_RETRY=(curl -fsS -o /dev/null --retry 10 --retry-delay 2 --retry-connrefused --max-time 15)
"${CURL_RETRY[@]}" "${APP_URL}/" || fail "Healthcheck aplikacji nie przeszedł: ${APP_URL}/ (rollback: patrz deploy/mikrus/README.md)"
"${CURL_RETRY[@]}" "${APP_URL}/pb/api/health" || fail "Healthcheck PocketBase nie przeszedł: ${APP_URL}/pb/api/health"

echo "✅ Deploy zakończony sukcesem!"
