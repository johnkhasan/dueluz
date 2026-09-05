# Trending algorithm

Implementation: [`apps/web/src/server/trending/score.ts`](../apps/web/src/server/trending/score.ts)

## The problem with the obvious formula

The original brief proposed:

```
score = engagement / pow(age + 2, decay)
```

This ranks correctly, but it has a property that costs real money at scale: the
score of every duel changes on every tick of the clock. Storing it in an indexed
column means a background job must rewrite the entire table continuously, and
not storing it means the feed cannot use an index at all — every page load sorts
the whole duel table in memory.

## What we use instead

An additive, Reddit-style hot score:

```
E     = 1·votes + 2·likes + 3·comments + 5·shares
order = log10(max(E, 1))
hot   = round(order + publishedAtSeconds / 90000, 7)
```

where `publishedAtSeconds` is seconds since a fixed epoch (2025-01-01).

### Why this shape

**The age term is added, not divided.** As time passes, every duel's score is
unchanged — a duel published an hour later simply starts `3600/90000 ≈ 0.04`
higher, forever. Relative order therefore only changes when *engagement*
changes.

That single property is what makes the whole design cheap:

- `hot_score` is a plain indexed column (`duels(status, hot_score DESC)`), so
  the trending feed is an index scan with keyset pagination.
- It is recomputed **only** inside the transaction that changed a counter
  (`recomputeHotScore`, called by vote / like / comment / share).
- There is no cron job, no queue, no periodic re-scoring of the table.

**The logarithm compresses runaway engagement.** Going from 10 to 100 weighted
engagement is worth exactly as much as going from 100 to 1000 — one full point.
Without it a single viral duel would occupy the top of the feed indefinitely and
new duels would never surface.

**The time constant is 90 000 seconds (~25 hours).** One order of magnitude of
engagement is worth about one day of freshness. A day-old duel needs ~10× the
engagement of a brand-new one to outrank it.

### Why these weights

| Action  | Weight | Rationale |
|---------|--------|-----------|
| vote    | 1      | One tap. The baseline unit of participation. |
| like    | 2      | Deliberate approval, but still cheap. |
| comment | 3      | Costs the user real effort and attention. |
| share   | 5      | The strongest signal that a duel deserves a wider audience — and it is the action the entire growth loop depends on. |

Shares are weighted highest on purpose: the product's success metric is Weekly
Meaningful Voters, and shares are the only engagement type that *creates* new
voters.

## Correctness properties

- `max(E, 1)` keeps `log10` finite for a duel with no engagement yet.
- The score is rounded to 7 decimals so it is stable as a `double precision`
  sort key and cursors compare exactly.
- Counters are updated with atomic `increment`, and the score is recomputed from
  the post-increment values while the transaction still holds the row lock, so
  concurrent votes cannot interleave into a stale score.

## Feeds

| Feed       | Order by                     | Cursor key   |
|------------|------------------------------|--------------|
| `trending` | `hot_score DESC, id DESC`    | `hot_score`  |
| `new`      | `published_at DESC, id DESC` | `published_at` |
| `popular`  | `vote_count DESC, id DESC`   | `vote_count` |

All three use keyset (cursor) pagination rather than `OFFSET`, because duels are
inserted and rescored constantly and an offset would skip or repeat rows between
pages.

## Tuning

Three constants govern behaviour, all in `score.ts`:

- `ENGAGEMENT_WEIGHTS` — relative value of each action.
- `TIME_CONSTANT_SECONDS` — how fast the feed turns over. Lower = more churn.
- `EPOCH_SECONDS` — fixed reference point; changing it shifts all scores
  uniformly and requires a one-off backfill.

Changing a weight or the time constant only affects duels scored afterwards.
To apply a change to existing rows, recompute `hot_score` for every duel once:

```sql
-- Then re-run recomputeHotScore for each duel, or backfill with the same formula.
UPDATE duels SET hot_score = 0 WHERE status = 'PUBLISHED';
```

## Rejected alternatives

- **Pure `vote_count`** — a three-year-old duel would sit on top forever. Kept
  as the separate `popular` feed instead, where that behaviour is the point.
- **Hacker News `E / (age_hours + 2)^1.5`** — good ranking, but time-dependent,
  so it reintroduces the re-scoring job.
- **Wilson score / bayesian average** — measures *which side is winning*, not
  *whether the duel is interesting*. The split is already shown as a percentage;
  ranking is about attention, not about the outcome.
