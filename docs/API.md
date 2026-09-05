# API reference

Base URL: `/api`. All responses use one envelope.

**Success**
```json
{ "success": true, "data": { }, "meta": { } }
```

**Error**
```json
{ "success": false, "error": { "code": "DUEL_NOT_FOUND", "message": "Duel not found" } }
```

Clients switch on `error.code`, never on `message`. Validation failures add
`error.details` as a `{ field: message }` map.

Mutating requests must send an `Origin` header matching the app's own origin.

## Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Payload failed schema validation (`details` has fields) |
| `UNAUTHORIZED` | 401 | Not signed in |
| `FORBIDDEN` | 403 | Signed in, insufficient role or not the owner |
| `NOT_FOUND` | 404 | Generic missing resource |
| `RATE_LIMITED` | 429 | Budget exhausted (`details.retryAfter` in seconds) |
| `CSRF_FAILED` | 403 | Cross-origin mutation rejected |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `EMAIL_TAKEN` / `USERNAME_TAKEN` | 409 | Already registered |
| `ACCOUNT_BANNED` | 403 | Account suspended |
| `WEAK_PASSWORD` | 422 | Fails the password policy |
| `DUEL_NOT_FOUND` | 404 | Missing, hidden or deleted duel |
| `DUEL_NOT_PUBLISHED` | 404 | Duel exists but is not open for voting |
| `OPTION_NOT_FOUND` | 404 | Option does not belong to this duel |
| `ALREADY_VOTED` | 409 | One vote per duel per identity |
| `ALREADY_REPORTED` | 409 | One report per target per reporter |
| `SPAM_DETECTED` | 422 | Text failed the spam heuristics |
| `FILE_TOO_LARGE` | 413 | Upload above 5 MB |
| `UNSUPPORTED_FILE_TYPE` | 415 | Not a JPEG, PNG or WebP |

## Auth

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | `{ email, username, displayName, password, locale? }`. Sets the session cookie. |
| POST | `/auth/login` | — | `{ email, password }` |
| POST | `/auth/logout` | session | Revokes the session server-side |
| GET | `/auth/me` | — | `{ user }` or `{ user: null }` |

## Duels

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/duels` | — | Query: `feed=trending\|new\|popular`, `category`, `q`, `author`, `cursor`, `limit` (≤50). `meta.nextCursor` continues the page. |
| POST | `/duels` | user | `{ title, description?, categoryId, visibility?, optionA:{name,imageUrl?,imageKey?}, optionB:{…} }` |
| GET | `/duels/:idOrSlug` | — | Includes `votedOptionId` and `liked` for the caller |
| PATCH | `/duels/:id` | owner / moderator | `{ title?, description?, categoryId?, visibility? }` |
| DELETE | `/duels/:id` | owner / moderator | Soft delete |
| POST | `/duels/:id/vote` | — | `{ optionId }` → `{ result }` with server-computed percentages, `inMajority`, `isTie` |
| POST | `/duels/:id/like` | user | Idempotent |
| DELETE | `/duels/:id/like` | user | Idempotent |
| POST | `/duels/:id/share` | — | `{ channel: COPY\|TELEGRAM\|WHATSAPP\|X\|FACEBOOK\|NATIVE\|OTHER }` |
| POST | `/duels/:id/report` | — | `{ reason, details? }` |

## Comments

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/duels/:id/comments` | — | `cursor`, `limit`; `meta.nextCursor` |
| POST | `/duels/:id/comments` | user | `{ content }` (≤1000 chars, plain text) |
| DELETE | `/comments/:id` | author / moderator | Soft delete |
| POST | `/comments/:id/like` | user | Toggles |
| POST | `/comments/:id/report` | — | `{ reason, details? }` |

## Misc

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/categories` | — | `?locale=uz\|ru\|en` |
| POST | `/uploads` | user | `multipart/form-data`: `file`, `kind=duel\|avatar` → `{ upload: { url, key } }` |
| POST | `/events` | — | `{ name, duelId?, locale?, props? }` |
| PATCH | `/me/profile` | user | `{ displayName?, bio?, locale?, avatarUrl? }` |
| POST | `/me/password` | user | `{ currentPassword, newPassword }` — revokes all sessions |

## Admin

All require `MODERATOR`; role changes and category writes require `ADMIN`.

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/stats` | Dashboard totals + Weekly Meaningful Voters |
| GET | `/admin/analytics` | `?days=7..90` daily series |
| GET | `/admin/users` | `?q`, `cursor` |
| POST | `/admin/users/:id` | `{ action: BAN\|UNBAN\|PROMOTE\|DEMOTE, reason?, days? }` |
| GET | `/admin/duels` | `?status`, `q`, `cursor` |
| POST | `/admin/duels/:id` | `{ action: HIDE\|RESTORE\|DELETE, note? }` |
| GET | `/admin/comments` | `?status`, `cursor` |
| POST | `/admin/comments/:id` | `{ action: HIDE\|RESTORE\|DELETE }` |
| GET | `/admin/reports` | `?status=PENDING\|RESOLVED\|DISMISSED` |
| POST | `/admin/reports/:id` | `{ action: RESOLVE\|DISMISS, note? }` |
| GET/POST | `/admin/categories` | List / create |
| PATCH/DELETE | `/admin/categories/:id` | Update / delete (deactivates when in use) |

## Pagination

Feeds use keyset cursors, not offsets — duels are inserted and rescored
constantly, so an offset would skip or repeat rows between pages.

```
GET /api/duels?feed=trending&limit=12
  → { data: { duels: [...] }, meta: { nextCursor: "NTg5Ljg0..." } }
GET /api/duels?feed=trending&limit=12&cursor=NTg5Ljg0...
```

A cursor encodes `(sortValue, id)` in base64url. Tampering yields
`BAD_REQUEST`, never a wrong page.
