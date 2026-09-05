#!/usr/bin/env bash
#
# Builds and (re)starts the Duel.uz stack from the source in /srv/dueluz.
# Safe to re-run: migrations are idempotent and the seed skips existing content.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

[ -f .env ] || fail ".env is missing. Copy .env.production.example and fill it in."
set -a; . ./.env; set +a

log "Checking required configuration"
for key in POSTGRES_PASSWORD SESSION_SECRET ANON_SECRET IP_SALT \
           NEXT_PUBLIC_APP_URL TELEGRAM_BOT_TOKEN NEXT_PUBLIC_TELEGRAM_BOT_USERNAME; do
  [ -n "${!key:-}" ] || fail "$key is empty in .env — the app will not start without it."
done
echo "    all set"

log "Building images"
$COMPOSE build web migrate

log "Starting datastores"
$COMPOSE up -d postgres redis
until docker exec dueluz-postgres pg_isready -U dueluz -d dueluz >/dev/null 2>&1; do sleep 2; done

log "Applying migrations"
$COMPOSE run --rm migrate

log "Seeding (skips content that already exists)"
$COMPOSE run --rm migrate pnpm exec tsx prisma/seed.ts

log "Starting the web container"
$COMPOSE up -d web

log "Waiting for health"
for _ in $(seq 1 60); do
  state=$(docker inspect dueluz-web --format '{{.State.Health.Status}}' 2>/dev/null || echo starting)
  [ "$state" = healthy ] && break
  sleep 2
done
[ "${state:-}" = healthy ] || { $COMPOSE logs --tail 40 web; fail "web container did not become healthy"; }

log "Smoke test"
docker exec dueluz-web node -e "
const B='http://127.0.0.1:3000';
(async () => {
  for (const p of ['/uz', '/ru', '/en', '/uz/explore', '/uz/login', '/robots.txt', '/sitemap.xml', '/api/categories?locale=uz']) {
    const r = await fetch(B + p);
    console.log('   ', r.ok ? 'OK  ' : 'FAIL', r.status, p);
    if (!r.ok) process.exitCode = 1;
  }
})();
"
log "Done. Containers:"
docker ps --filter name=dueluz --format '    {{.Names}}\t{{.Status}}'
