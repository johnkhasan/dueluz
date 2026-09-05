-- Trigram search index backing GET /api/duels?q=
-- `search_text` holds "title + option names + category name" lowercased and is
-- maintained by the application inside the same transaction as the duel write.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "duels_search_text_trgm_idx"
  ON "duels" USING gin ("search_text" gin_trgm_ops);

-- Case-insensitive lookups for login and profile URLs.
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_key" ON "users" (lower("email"));
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_lower_key" ON "users" (lower("username"));

-- A report always points at exactly one target, matching its target_type.
ALTER TABLE "reports"
  DROP CONSTRAINT IF EXISTS "reports_target_exclusive";
ALTER TABLE "reports"
  ADD CONSTRAINT "reports_target_exclusive" CHECK (
    ("target_type" = 'DUEL'    AND "duel_id" IS NOT NULL AND "comment_id" IS NULL) OR
    ("target_type" = 'COMMENT' AND "comment_id" IS NOT NULL AND "duel_id" IS NULL)
  );

-- Denormalised counters must never be able to go negative, even if a future
-- code path decrements twice. The database is the last line of defence.
ALTER TABLE "duels" DROP CONSTRAINT IF EXISTS "duels_counters_non_negative";
ALTER TABLE "duels" ADD CONSTRAINT "duels_counters_non_negative" CHECK (
  "vote_count" >= 0 AND "like_count" >= 0 AND "comment_count" >= 0
  AND "share_count" >= 0 AND "view_count" >= 0
);

ALTER TABLE "duel_options" DROP CONSTRAINT IF EXISTS "duel_options_vote_count_non_negative";
ALTER TABLE "duel_options" ADD CONSTRAINT "duel_options_vote_count_non_negative"
  CHECK ("vote_count" >= 0);

ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_like_count_non_negative";
ALTER TABLE "comments" ADD CONSTRAINT "comments_like_count_non_negative"
  CHECK ("like_count" >= 0);

-- A vote must be attributable to exactly one identity: an account or an
-- anonymous browser session. This is what makes the two partial unique indexes
-- below a complete "one vote per duel" guarantee.
ALTER TABLE "votes" DROP CONSTRAINT IF EXISTS "votes_single_identity";
ALTER TABLE "votes" ADD CONSTRAINT "votes_single_identity" CHECK (
  ("user_id" IS NOT NULL AND "anon_id" IS NULL) OR
  ("user_id" IS NULL AND "anon_id" IS NOT NULL)
);
