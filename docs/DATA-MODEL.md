# Data model

Schema: [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma)

## Entity relationships

```
User ─┬─< Session
      ├─< Duel (author, SET NULL — a deleted account leaves its duels standing)
      ├─< Vote
      ├─< Comment ──< CommentLike
      ├─< DuelLike
      ├─< Report (reporter / resolver)
      ├─< Share
      ├─< Notification
      └─< AnalyticsEvent

Category ──< Duel (RESTRICT — a category in use cannot be dropped)

Duel ─┬─< DuelOption ──< Vote
      ├─< Vote
      ├─< Comment
      ├─< DuelLike
      ├─< Share
      ├─< Report
      └─< AnalyticsEvent
```

## Design decisions

### Denormalised counters

`Duel` stores `voteCount`, `likeCount`, `commentCount`, `shareCount`,
`viewCount`; `DuelOption` stores `voteCount`; `Comment` stores `likeCount`.

Feeds render dozens of duels per page and every one needs its totals — counting
rows per card would be a query per card. Counters are only ever mutated inside
the same transaction as the row that causes the change, and `CHECK (… >= 0)`
constraints stop a future double-decrement from going negative.

### One vote per duel per identity

```prisma
@@unique([duelId, userId])
@@unique([duelId, anonId])
```

plus a `CHECK` that exactly one of `user_id` / `anon_id` is set. Together these
are a complete guarantee, and because it is the *database* that enforces it,
concurrent requests cannot both succeed. See
[SECURITY.md](./SECURITY.md#vote-integrity).

### Soft deletes

`Duel.status` and `Comment.status` carry `DELETED` rather than removing rows,
so moderation history and report context survive. Every read path filters on
status; there is no "deleted" leak into a feed, a search or an OG image.

### `searchText`

A lowercase, punctuation-stripped concatenation of title + option names +
description + category names in all three languages, maintained by the
application inside the duel's write transaction, with a `pg_trgm` GIN index.

A generated column was not possible because the text spans three tables. Search
splits the query into words and requires all of them, so "iphone samsung" finds
a duel whose text is "iphone 17 pro samsung galaxy s26 technology".

### `hotScore`

A stored, indexed `double precision` column. Correct as a stored value only
because the ranking formula's age term is additive — see
[TRENDING.md](./TRENDING.md).

### Sessions, not JWTs

`Session.tokenHash` stores `SHA-256(token)`. Server-side sessions are revocable,
which bans, password changes and "log out everywhere" all depend on. A
stateless JWT would keep working until it expired.

### Reports

Not polymorphic: `targetType` plus nullable `duelId` / `commentId`, with a
`CHECK` that the pair matches the type. This keeps real foreign keys (and
cascade deletes) that a generic `(target_type, target_id)` pair would lose.

### Case-insensitive identity

Unique indexes on `lower(email)` and `lower(username)` prevent `Javohir` and
`javohir` from being two accounts.

## Indexes

| Table | Index | Serves |
|---|---|---|
| `duels` | `(status, published_at DESC)` | the `new` feed |
| `duels` | `(status, hot_score DESC)` | the `trending` feed |
| `duels` | `(status, vote_count DESC)` | the `popular` feed |
| `duels` | `(status, category_id, published_at DESC)` | category filter |
| `duels` | `(author_id, created_at DESC)` | profile and "my duels" |
| `duels` | `slug` unique | duel page lookup |
| `duels` | GIN `search_text gin_trgm_ops` | search |
| `votes` | `(duel_id, user_id)` / `(duel_id, anon_id)` unique | vote integrity |
| `votes` | `(user_id, created_at DESC)` | profile vote stats |
| `comments` | `(duel_id, status, created_at DESC)` | comment list |
| `reports` | `(status, created_at DESC)` | moderation queue |
| `users` | `lower(email)`, `lower(username)` unique | login, profile URLs |
| `analytics_events` | `(name, created_at DESC)` | admin daily series |

## Slugs

`<option-a>-vs-<option-b>-<6 random chars>`, e.g.
`iphone-17-pro-vs-galaxy-s26-ultra-4m6x5t`.

Readable enough to carry meaning in a shared link, with a random suffix that
guarantees uniqueness without a retry loop and keeps slugs non-enumerable.
Cyrillic is transliterated before Unicode normalisation, so `Дунё` becomes
`dunyo` rather than `dune`.

## Migrations

```
20260905090403_init                    baseline schema
20260905090500_search_and_constraints  pg_trgm index, CHECK constraints,
                                       case-insensitive unique indexes
```

Constraints that Prisma cannot express live in the second, hand-written
migration.
