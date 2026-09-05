/**
 * Trending score. See docs/TRENDING.md for the derivation and the tuning
 * rationale; this file is the single implementation.
 */

export type EngagementCounts = {
  voteCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
};

/**
 * Weighted engagement. The weights encode how much each action costs a user:
 * a vote is one tap, a share is a deliberate act of distribution and is the
 * strongest signal that a duel is worth showing to more people.
 */
export const ENGAGEMENT_WEIGHTS = {
  vote: 1,
  like: 2,
  comment: 3,
  share: 5,
} as const;

/** Seconds of freshness worth one order of magnitude of engagement (~25h). */
export const TIME_CONSTANT_SECONDS = 90_000;

/** Fixed origin so scores stay small and comparable. 2025-01-01T00:00:00Z. */
export const EPOCH_SECONDS = 1_735_689_600;

export function engagement(counts: EngagementCounts): number {
  return (
    counts.voteCount * ENGAGEMENT_WEIGHTS.vote +
    counts.likeCount * ENGAGEMENT_WEIGHTS.like +
    counts.commentCount * ENGAGEMENT_WEIGHTS.comment +
    counts.shareCount * ENGAGEMENT_WEIGHTS.share
  );
}

/**
 * Reddit-style additive hot score.
 *
 * The age term is *added*, not divided by, which is the crucial property: as
 * time passes every duel's score is unchanged, so relative ordering only
 * changes when engagement changes. That means the column can be indexed and
 * recomputed inside the write transaction that caused the change — there is no
 * background job re-scoring the whole table.
 */
export function hotScore(counts: EngagementCounts, publishedAt: Date | null): number {
  const seconds = (publishedAt ?? new Date()).getTime() / 1000 - EPOCH_SECONDS;
  const order = Math.log10(Math.max(engagement(counts), 1));
  return Number((order + seconds / TIME_CONSTANT_SECONDS).toFixed(7));
}
