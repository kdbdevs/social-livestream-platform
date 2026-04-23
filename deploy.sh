#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.env"
COMPOSE_FILE="$ROOT_DIR/infrastructure/compose/vps.yml"
SRS_TEMPLATE="$ROOT_DIR/infrastructure/compose/srs.vps.conf"
GENERATED_DIR="$ROOT_DIR/infrastructure/compose/.generated"
GENERATED_SRS="$GENERATED_DIR/srs.vps.generated.conf"
SRS_VPS_CONFIG="./.generated/$(basename "$GENERATED_SRS")"
FRONTEND_DIR="/www/wwwroot/app.aweekday.site"
SKIP_INSTALL=0
SKIP_SEED=0
SKIP_FRONTEND=0
SKIP_PM2=0

usage() {
  cat <<'EOF'
Usage: bash deploy.sh [options]

Options:
  --env-file PATH         Use a custom env file. Default: .env
  --frontend-dir PATH     Target directory for built frontend files.
                          Default: /www/wwwroot/app.aweekday.site
  --skip-install          Skip npm install
  --skip-seed             Skip npm run db:seed
  --skip-frontend         Skip syncing apps/web-app/dist
  --skip-pm2              Skip PM2 startOrRestart/save/startup
  --help                  Show this help

Example:
  bash deploy.sh
  bash deploy.sh --skip-seed
  bash deploy.sh --env-file .env.production --frontend-dir /www/wwwroot/app.aweekday.site
EOF
}

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  printf '\n[ERROR] %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Command '$1' tidak ditemukan."
}

escape_sed_replacement() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

load_env_file() {
  [[ -f "$ENV_FILE" ]] || fail "File env tidak ditemukan: $ENV_FILE"

  set -a
  # shellcheck disable=SC1090
  source <(grep -vE '^[[:space:]]*#' "$ENV_FILE" | grep -vE '^[[:space:]]*$' | sed 's/\r$//')
  set +a
}

require_env() {
  local name="$1"
  local value="${!name:-}"

  [[ -n "$value" ]] || fail "Env '$name' wajib diisi."

  case "$value" in
    *CHANGE_ME*|replace-with-*|GANTI_*|ISI_*)
      fail "Env '$name' masih placeholder. Isi dulu nilai production yang valid."
      ;;
  esac
}

wait_for_postgres() {
  local attempt

  for attempt in $(seq 1 30); do
    if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d livestream >/dev/null 2>&1; then
      return 0
    fi

    sleep 2
  done

  return 1
}

setup_pm2() {
  local current_user home_dir

  if [[ "$(id -u)" -eq 0 ]]; then
    current_user="root"
    home_dir="/root"
  else
    current_user="$(id -un)"
    home_dir="$HOME"
  fi

  pm2 startOrRestart "$ROOT_DIR/ecosystem.config.cjs" --update-env
  pm2 save
  pm2 startup systemd -u "$current_user" --hp "$home_dir" >/dev/null || true
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      [[ $# -ge 2 ]] || fail "--env-file butuh nilai path."
      ENV_FILE="$2"
      shift 2
      ;;
    --frontend-dir)
      [[ $# -ge 2 ]] || fail "--frontend-dir butuh nilai path."
      FRONTEND_DIR="$2"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --skip-seed)
      SKIP_SEED=1
      shift
      ;;
    --skip-frontend)
      SKIP_FRONTEND=1
      shift
      ;;
    --skip-pm2)
      SKIP_PM2=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "Argumen tidak dikenal: $1"
      ;;
  esac
done

require_command docker
require_command npm
require_command node
require_command npx
require_command rsync
require_command sed

cd "$ROOT_DIR"
load_env_file

require_env NODE_ENV
require_env DATABASE_URL
require_env REDIS_URL
require_env JWT_SECRET
require_env API_CORS_ORIGIN
require_env MEDIA_HOOK_SECRET
require_env RTMP_INGEST_URL
require_env PLAYBACK_BASE_URL
require_env POSTGRES_PASSWORD

[[ "$NODE_ENV" == "production" ]] || fail "NODE_ENV harus 'production' untuk deploy VPS."
[[ -f "$SRS_TEMPLATE" ]] || fail "Template SRS tidak ditemukan: $SRS_TEMPLATE"
[[ -f "$COMPOSE_FILE" ]] || fail "Compose file tidak ditemukan: $COMPOSE_FILE"

mkdir -p "$GENERATED_DIR"
sed "s/CHANGE_ME_MEDIA_HOOK_SECRET/$(escape_sed_replacement "$MEDIA_HOOK_SECRET")/g" "$SRS_TEMPLATE" > "$GENERATED_SRS"

log "Konfigurasi SRS production sudah dirender ke $GENERATED_SRS"

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  log "Menjalankan npm install"
  npm install
else
  log "Melewati npm install"
fi

log "Menyalakan Docker infra"
export SRS_VPS_CONFIG
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

log "Menunggu PostgreSQL siap"
wait_for_postgres || fail "PostgreSQL belum siap setelah beberapa percobaan."

log "Build seluruh workspace"
npm run build

log "Sinkronisasi schema Prisma"
npx prisma db push --schema packages/db/prisma/schema.prisma

if [[ "$SKIP_SEED" -eq 0 ]]; then
  log "Menjalankan seed database"
  npm run db:seed
else
  log "Melewati seed database"
fi

if [[ "$SKIP_FRONTEND" -eq 0 ]]; then
  log "Publish frontend ke $FRONTEND_DIR"
  mkdir -p "$FRONTEND_DIR"
  rsync -av --delete "$ROOT_DIR/apps/web-app/dist/" "$FRONTEND_DIR/"
else
  log "Melewati publish frontend"
fi

if [[ "$SKIP_PM2" -eq 0 ]]; then
  require_command pm2
  log "Menjalankan atau me-restart service PM2"
  setup_pm2
else
  log "Melewati setup PM2"
fi

log "Ringkasan status Docker"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

if [[ "$SKIP_PM2" -eq 0 ]]; then
  log "Ringkasan status PM2"
  pm2 status
fi

cat <<EOF

Deploy selesai.

Yang sudah dikerjakan script ini:
- render config SRS production dari MEDIA_HOOK_SECRET
- docker compose up untuk postgres, redis, srs
- npm install
- npm run build
- prisma db push
- db seed $( [[ "$SKIP_SEED" -eq 0 ]] && printf 'dijalankan' || printf 'dilewati' )
- publish frontend $( [[ "$SKIP_FRONTEND" -eq 0 ]] && printf "ke $FRONTEND_DIR" || printf 'dilewati' )
- PM2 $( [[ "$SKIP_PM2" -eq 0 ]] && printf 'diupdate' || printf 'dilewati' )

Langkah manual yang masih perlu:
- buat website dan reverse proxy di aaPanel
- pasang SSL untuk app.aweekday.site, api.aweekday.site, hooks.aweekday.site, stream.aweekday.site
- buka port publik 80, 443, dan 1935
EOF
