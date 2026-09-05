# Architecture

## Shape

A single Next.js 15 application, with the domain logic isolated in
`src/server/<domain>/` behind a REST API.

```
apps/web/
  src/app/[locale]/       pages (SSR, locale-prefixed)
  src/app/api/            REST route handlers
  src/server/<domain>/    ALL business logic
  src/lib/                cross-cutting primitives
  src/components/         UI
  src/messages/           uz / ru / en dictionaries
packages/db/              Prisma schema, migrations, seed
```

### Why not a separate NestJS API

The brief asked for `apps/web` + `apps/api` + `apps/admin`, and also asked not
to over-engineer. For this MVP those two instructions conflict, and the second
one wins:

- Duel pages must be server-rendered for SEO and must generate dynamic OG
  images. Both are native to Next.js and would otherwise need a BFF layer in
  front of the API anyway.
- A separate API means CORS, cookie-domain configuration, duplicated DTOs and
  three deploy targets — roughly twice the code for the same features.
- The admin panel shares the entire auth, layout and component stack. As
  `/admin/*` routes it costs a layout guard; as a separate app it costs a second
  auth implementation.

The cost of that decision is contained by one rule:

> **All business logic lives in `src/server/<domain>/*.service.ts`.**
> A route handler only validates input, checks authorization, calls a service
> and wraps the result in the response envelope. React components contain no
> business logic and never touch Prisma.

Services take plain arguments and return plain data — no `Request`, no
`Response`, no React. Moving them behind a NestJS controller later is a
mechanical change.

## Layers

```
 Route handler  ──▶  validate (zod) ──▶ authorize (guards) ──▶ service ──▶ Prisma
      │                                                            │
      └──────────────── envelope { success, data, meta } ◀──────────┘

 Server Component ──▶ service ──▶ Prisma        (no HTTP hop for SSR reads)
```

Server Components call services directly rather than fetching their own API.
The same service therefore backs both the SSR render and the JSON endpoint,
which is what keeps the two from drifting.

## Domains

| Module | Responsibility |
|---|---|
| `auth` | Telegram payload verification, sign-in/account creation, sessions, RBAC guards |
| `duels` | create/read/update/delete, feeds, search, cursor pagination |
| `votes` | the transactional vote path |
| `comments`, `likes`, `reports` | engagement and moderation intake |
| `trending` | the ranking formula and its recomputation |
| `categories` | taxonomy, cached |
| `uploads` | image validation, normalisation, storage |
| `admin` | moderation queues and actions |
| `analytics` | event capture and the admin's aggregate queries |

## Cross-cutting primitives (`src/lib`)

| Module | Purpose |
|---|---|
| `env` | zod-validated environment, parsed once at boot |
| `api` | response envelope, error mapping, body/query parsing |
| `errors` | `AppError` + the public error-code contract |
| `crypto` | token generation, hashing, HMAC signing, IP fingerprints |
| `rate-limit` | fixed-window limiter (Redis, in-process fallback) |
| `redis` | shared connection; every caller degrades gracefully |
| `cursor` | keyset pagination encode/decode |
| `sanitize` | text normalisation and spam heuristics |
| `storage` | `StorageAdapter`: local disk or S3-compatible |
| `validation` | zod schemas shared by client forms and server routes |
| `i18n` | locale negotiation and dictionaries |

## Data flow of a vote

The product's critical path, end to end:

```
click a side
   │
   ▼
POST /api/duels/:id/vote        assertSameOrigin → rate limit → identity
   │
   ▼
castVote()  ── transaction ──┐
   │  insert vote            │  unique constraint = the duplicate check
   │  option.voteCount++     │
   │  duel.voteCount++       │  takes the row lock
   │  recomputeHotScore()    │  reads post-increment values under that lock
   └─────────────────────────┘
   │
   ▼
server-computed percentages → UI reveals result → share prompt
```

The percentages returned to the client always come from the database read at
the end of that transaction. The UI never estimates them.

## Rendering and caching

- Feed and duel pages are `force-dynamic`: whether *you* have voted is part of
  the render, so a shared cache would be wrong.
- The category list is cached in Redis for five minutes — it changes rarely and
  is read on nearly every page.
- View counts are deduplicated per viewer per hour with a Redis `SET NX`; with
  no Redis the increment is skipped rather than inflated on every refresh.
- `sitemap.xml` revalidates hourly.

## Internationalisation

Every page lives under an explicit locale prefix (`/uz`, `/ru`, `/en`) so each
translation has a canonical, indexable URL and correct `hreflang`. Middleware
redirects an unprefixed path using the locale cookie, then `Accept-Language`.

Only the active dictionary is sent to the client; the other two never reach the
browser bundle.

Uzbek dates, relative times and compact numbers are formatted by hand rather
than through `Intl`: browsers ship no `uz-UZ` data (Chromium renders
`2026 M09 4` and falls back to English for relative times) while Node does,
which both looks wrong to an Uzbek reader and breaks hydration.

## Storage

`StorageAdapter` has two implementations: local disk (development, writes into
`public/uploads`) and S3-compatible (production — S3, R2, MinIO). Switching is
an environment-variable change. The S3 SDK is imported lazily so the local
driver never pays for it.

## Future extension points

Deliberately present but unused, so adding them later is not a migration:

- `Notification` model and `AnalyticsEvent` model — schema exists, no MVP UI.
- `visibility: UNLISTED` — link-only duels already work end to end.
- `DuelOption.position` — the schema does not assume exactly two options.
- `auth` keeps `issueSession()` separate from cookie writing, so a second
  identity provider beside Telegram can issue a session directly.
