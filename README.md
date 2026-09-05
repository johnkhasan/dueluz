# Duel.uz

A social voting platform: two options, one question, one tap.
*iPhone vs Samsung. Messi vs Ronaldo. Osh vs Somsa.*

The product is built around one loop:

> **Discover a duel → vote → see the result → find out if you are with the
> crowd → share → a friend votes → a friend creates a duel.**

Primary metric: **Weekly Meaningful Voters** (distinct identities that cast at
least one vote in the last 7 days), surfaced on the admin dashboard.

---

## Quick start

Requires Node ≥ 20.11, pnpm 10 and Docker.

```bash
docker compose up -d          # PostgreSQL on :5434, Redis on :6380
node scripts/setup-env.mjs    # writes .env with freshly generated secrets
pnpm install
pnpm db:migrate               # apply migrations
pnpm db:seed                  # 12 categories, 6 users, ~36 duels with activity
pnpm dev                      # http://localhost:3000
```

### Telegram sign-in

Sign-in is Telegram-only — there is no password anywhere in the app. Set up a
bot once with [@BotFather](https://t.me/BotFather):

1. `/newbot` → put the token in `TELEGRAM_BOT_TOKEN` and the bot's handle in
   `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (no `@`).
2. `/setdomain` → the host of `NEXT_PUBLIC_APP_URL`. **`localhost` is not
   accepted**, so testing sign-in locally needs a tunnel (ngrok, Cloudflare
   Tunnel) with both `NEXT_PUBLIC_APP_URL` and `/setdomain` pointed at it.
3. Put your own numeric Telegram id (ask [@userinfobot](https://t.me/userinfobot))
   in `SEED_ADMIN_TELEGRAM_ID` and re-run `pnpm db:seed` — your first sign-in
   then lands on the ADMIN account.

Everything except signing in works without a bot: browsing, anonymous voting and
the whole seeded dataset.

Redis is optional — without it the app falls back to an in-process rate limiter
and cache. Do not run more than one replica that way.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Generate the Prisma client and build for production |
| `pnpm start` | Run the production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:integration` | Integration tests against `TEST_DATABASE_URL` |
| `pnpm test:e2e` | Playwright, mobile (WebKit) + desktop (Chromium) |
| `pnpm db:migrate` / `db:deploy` | Migrations, dev / production |
| `pnpm db:seed` / `db:reset` / `db:studio` | Seed, reset, Prisma Studio |

Before the integration suite, create its database once:

```bash
docker exec dueluz-postgres psql -U dueluz -d postgres -c "CREATE DATABASE dueluz_test OWNER dueluz;"
DATABASE_URL="postgresql://dueluz:dueluz@localhost:5434/dueluz_test?schema=public" \
  pnpm --filter @dueluz/db exec prisma migrate deploy
```

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict, no `any`) ·
Tailwind CSS v4 · PostgreSQL 16 + Prisma 6 · Redis 7 (optional) · Zod ·
Telegram Login Widget / Mini App · Vitest · Playwright.

## Features

**Voting** — anonymous or signed in, one vote per duel per identity enforced by
a database constraint, results revealed the instant you vote.

**Accounts** — one-tap Telegram sign-in, and no sign-in at all inside Telegram:
opened as a Mini App, the session is established from the identity the client
already provides. No passwords are stored, so none can leak.

**Discovery** — trending / new / popular feeds with keyset pagination, category
filters, trigram search across titles, option names and categories.

**Creation** — a four-step wizard with image upload, live preview and
server-side validation of everything.

**Social** — flat comments, likes, reports, and a share sheet (Telegram,
WhatsApp, X, copy link, Web Share API) that opens automatically the moment you
learn whether you are in the majority.

**Growth** — a per-duel dynamic OG image showing the matchup and the split,
which is what a Telegram or X preview renders.

**Moderation** — `/admin` with dashboard, report queue, duel/comment/user
moderation, category management and analytics.

**Three languages** — uz / ru / en, locale-prefixed URLs with `hreflang`.

## Layout

```
apps/web/src/
  app/[locale]/       pages          app/api/        REST handlers
  server/<domain>/    business logic lib/            primitives
  components/         UI             messages/       uz | ru | en
packages/db/          Prisma schema, migrations, seed
docs/                 architecture, API, data model, security, trending
```

**One rule holds the structure together:** business logic lives only in
`src/server/<domain>/*.service.ts`. Route handlers validate, authorize, call a
service and wrap the result. Components never touch Prisma.

## Documentation

| Document | Contents |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layering, why a single app, request flow |
| [DATA-MODEL.md](docs/DATA-MODEL.md) | Schema, indexes, design decisions |
| [API.md](docs/API.md) | Endpoints, envelope, error codes, pagination |
| [SECURITY.md](docs/SECURITY.md) | Threat model and every control |
| [TRENDING.md](docs/TRENDING.md) | The ranking formula and why it is shaped that way |

## Configuration

`.env` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `TEST_DATABASE_URL` | PostgreSQL |
| `REDIS_URL` | Optional. Empty = in-process fallback |
| `SESSION_SECRET`, `ANON_SECRET`, `IP_SALT` | ≥32 chars each, validated at boot |
| `NEXT_PUBLIC_APP_URL` | Canonical origin — drives canonical URLs, OG images, CSP |
| `STORAGE_DRIVER` | `local` or `s3` |
| `S3_*` | Bucket credentials when `STORAGE_DRIVER=s3` (S3, R2, MinIO) |

## Deployment notes

- Set `NEXT_PUBLIC_APP_URL` to the real **https** origin. HSTS and
  `upgrade-insecure-requests` are emitted only for https origins.
- Run behind a reverse proxy that **overwrites** `X-Forwarded-For`; the app
  hashes it for abuse control and trusts it as given.
- Provide `REDIS_URL` before scaling past one instance.
- Switch `STORAGE_DRIVER=s3`; the local driver writes into `public/uploads`,
  which is per-instance and ephemeral.
- Run `pnpm db:deploy` (not `db:migrate`) in production.

## Not in the MVP

Followers, XP/badges/leaderboards, notification UI, monetisation, AI summaries,
more than two options per duel, changing a vote, threaded comments, a second
identity provider. The schema and the auth module leave room for each.
