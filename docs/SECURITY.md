# Security model

## Threat model

Duel.uz is a public voting platform where anonymous participation is a product
requirement. The realistic adversaries are:

1. **Vote stuffers** — inflating a duel's result.
2. **Spammers** — link farms in comments and duel titles.
3. **Abusive uploaders** — using image upload as a stored-XSS or malware vector.
4. **Account takeover** — credential stuffing against a leaked password list.
5. **Privilege escalation** — a normal user reaching moderator endpoints.

## Authentication

- **Passwords**: argon2id (`@node-rs/argon2`), 19 MiB memory / 2 iterations,
  OWASP-recommended parameters. Memory-hard, so a leaked table is expensive to
  crack on GPUs.
- **Policy**: minimum 8 characters, must mix letters and digits, common
  passwords rejected. Length carries the strength; the class rule only rules out
  the trivial cases.
- **Login timing**: an unknown email is verified against a real argon2 digest
  generated once per process, so a missing account and a wrong password take the
  same time and cannot be told apart.
- **Sessions**: opaque random 256-bit tokens. The database stores only
  `SHA-256(token)` — a database leak cannot be replayed as a login. Sessions are
  revocable (ban, password change, "log out everywhere") which a stateless JWT
  would not be.
- **Cookie**: `httpOnly`, `sameSite=lax`, 30 days. The `Secure` flag is keyed
  to whether `NEXT_PUBLIC_APP_URL` is https, not to `NODE_ENV`: a `Secure`
  cookie is silently dropped by the browser over plain http, so tying it to the
  build mode would break sign-in and anonymous voting on an http staging box
  with no visible error, while a TLS-terminating proxy still gets secure
  cookies because the app's public URL is https.

## Anonymous identity

Every visitor is issued `duel_anon`: a random UUID signed with
`HMAC-SHA256(ANON_SECRET)`, in an httpOnly cookie.

Signing means a client cannot mint fresh identities by editing the cookie value
— only delete it, which is equivalent to clearing cookies. Combined with the
per-IP rate limit and the `ip_hash` on each vote, this makes casual vote
stuffing costly without requiring registration.

The cookie is issued by middleware on the first page load, and by the write
routes themselves (`ensureAnon`) for clients that arrive at the API first.

## Vote integrity

This is the property the product cannot compromise on.

- Uniqueness is a **database constraint** (`@@unique([duelId, userId])` and
  `@@unique([duelId, anonId])`), not a read-then-write check. Two simultaneous
  requests cannot both succeed; the loser's insert violates the constraint and
  is translated into `ALREADY_VOTED`.
- A `CHECK` constraint enforces that a vote carries exactly one identity
  (account **or** anonymous session), so the two unique indexes together are a
  complete guarantee.
- The vote row and both counters are written in one transaction, so a crash can
  never leave a vote without its count.
- The option is re-checked against the duel server-side: a client cannot vote
  for an option belonging to a different duel.
- Counters carry `CHECK (… >= 0)` constraints as a last line of defence against
  a future double-decrement bug.
- Percentages are always computed from server-side counts. Client-supplied
  counts are never read.

Verified by `apps/web/tests/integration/voting.test.ts`, including an 8-way
concurrent-vote race.

## CSRF

Two independent layers:

1. `SameSite=Lax` session cookie — blocks cross-site form posts and fetches.
2. `assertSameOrigin()` on every mutating route — the `Origin` header must match
   the app's own origin. In production a missing `Origin` is also rejected.

## Rate limiting

Fixed-window counters in Redis, with an in-process fallback when Redis is
unavailable (single-instance only — Redis is required in production for the
limit to hold across replicas).

Budgets are in `apps/web/src/lib/rate-limit.ts`.

**IP-keyed budgets are deliberately generous.** Uzbek mobile carriers run
large-scale CGNAT, so one public IP can front thousands of genuine visitors. A
budget tight enough to stop a determined script would lock out an entire
carrier. Correctness never depends on rate limiting — the unique constraint
does that — so the limiter only has to make abuse tedious.

## Privacy

Raw IP addresses are **never stored**. Where a network fingerprint is needed it
is `HMAC-SHA256(ip, IP_SALT + today's date)`, truncated to 128 bits. The daily
salt rotation means a stored hash cannot be correlated across days, while
same-day abuse detection still works.

Analytics events are attributed to an account id or the signed anonymous cookie
— never to an IP address or any identifier the visitor did not opt into by
using the site.

## User-generated content

The application **never accepts or renders HTML**. All user text is stored and
displayed as plain text, so React's own escaping is the XSS boundary and there
is no sanitiser to bypass.

Before storage, text is normalised: Unicode format characters (zero-width
spaces, bidi overrides, the BOM) and control characters are stripped, because
they are used to smuggle lookalike or reversed text past moderation and to fake
non-empty comments.

Conservative spam heuristics reject link floods, all-caps shouting, long
character runs, and a comment identical to the author's previous one on the same
duel.

## File uploads

Defence in depth, in this order:

1. Size checked before and after reading the body (≤ 5 MB).
2. **Magic-byte detection** determines the real type. The filename and
   client-supplied `Content-Type` are never trusted — an HTML or SVG payload
   with a `.jpg` extension is the classic stored-XSS vector.
3. Dimensions capped at 4096 px; `limitInputPixels` guards against decompression
   bombs.
4. The image is **re-encoded to WebP through sharp**. This strips EXIF
   (including GPS), discards any trailing polyglot payload, and guarantees the
   stored bytes are a real image rather than something that merely starts like
   one.
5. The stored key is a random UUID under a per-owner prefix, so it is not
   guessable and the attacker-controlled original filename is discarded.
6. Uploads require an account and are rate limited.

## Authorization

- `requireUser()` / `requireRole(role)` guards on every protected route.
- Roles are hierarchical: `ADMIN` ⊃ `MODERATOR` ⊃ `USER`.
- `/admin/*` is guarded in the layout **and** independently re-checked in every
  `/api/admin/*` handler — the layout is a UX guard, the API check is the
  security boundary.
- Administrators cannot be moderated through the admin API; only an admin can
  change roles or act on a moderator; nobody can moderate themselves.
- A ban revokes every live session immediately rather than waiting for the
  cookie to expire.

Never trusted from a client: vote counts, user ids, roles, permissions,
statistics.

## HTTP headers

Set in `apps/web/next.config.ts`:

- `Content-Security-Policy` — `default-src 'self'`, no `object-src`,
  `frame-ancestors 'none'`. `upgrade-insecure-requests` is emitted **only** when
  `NEXT_PUBLIC_APP_URL` is https; on an http origin it would rewrite every
  asset URL to https and break the page entirely.
- `Strict-Transport-Security` (production only), `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.

`'unsafe-inline'` for styles is required by Next's inlined critical CSS;
`'unsafe-eval'` is development-only (React Refresh).

## Secrets

`SESSION_SECRET`, `ANON_SECRET` and `IP_SALT` are validated at boot (minimum 32
characters) so a misconfigured deploy fails loudly instead of silently
degrading. `.env` is gitignored; only `.env.example` is committed, and
`node scripts/setup-env.mjs` generates real random values.

## Known limitations

- **Determined vote stuffing** — someone with many IPs and a script can still
  inflate a duel. Mitigating further would require registration to vote, which
  would cost more than the abuse does. `ip_hash` is retained so bulk stuffing is
  detectable after the fact.
- **In-process rate limiting** — without Redis, limits are per-instance. Deploy
  Redis before running more than one replica.
- **No email verification** — an unverified address cannot be used for password
  reset, so reset is not offered in the MVP.
- **`x-forwarded-for` is trusted** — correct only behind a reverse proxy that
  overwrites it. Ensure nginx sets `proxy_set_header X-Forwarded-For $remote_addr`.
