import { describe, expect, it } from 'vitest';
import {
  EPOCH_SECONDS,
  TIME_CONSTANT_SECONDS,
  engagement,
  hotScore,
} from '@/server/trending/score';

const at = (secondsAfterEpoch: number) => new Date((EPOCH_SECONDS + secondsAfterEpoch) * 1000);
const counts = (over: Partial<Parameters<typeof engagement>[0]> = {}) => ({
  voteCount: 0,
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
  ...over,
});

describe('engagement', () => {
  it('weights an action by how much it costs the user', () => {
    expect(engagement(counts({ voteCount: 1 }))).toBe(1);
    expect(engagement(counts({ likeCount: 1 }))).toBe(2);
    expect(engagement(counts({ commentCount: 1 }))).toBe(3);
    expect(engagement(counts({ shareCount: 1 }))).toBe(5);
  });

  it('sums every signal', () => {
    expect(engagement(counts({ voteCount: 10, likeCount: 2, commentCount: 1, shareCount: 1 }))).toBe(
      10 + 4 + 3 + 5,
    );
  });
});

describe('hotScore', () => {
  it('ranks a more engaged duel above a less engaged one of the same age', () => {
    const when = at(0);
    expect(hotScore(counts({ voteCount: 100 }), when)).toBeGreaterThan(
      hotScore(counts({ voteCount: 10 }), when),
    );
  });

  it('ranks a newer duel above an older one with the same engagement', () => {
    expect(hotScore(counts({ voteCount: 10 }), at(86_400))).toBeGreaterThan(
      hotScore(counts({ voteCount: 10 }), at(0)),
    );
  });

  /**
   * The property the whole design rests on: the age term is additive, so time
   * passing shifts every score by the same amount and never reorders the feed.
   * That is what makes a stored, indexed `hotScore` column correct without a
   * background re-scoring job.
   */
  it('preserves relative order as time passes', () => {
    const older = hotScore(counts({ voteCount: 500 }), at(0));
    const newer = hotScore(counts({ voteCount: 20 }), at(3 * TIME_CONSTANT_SECONDS));
    const gap = newer - older;

    // Shift both publish times by a week: the gap is unchanged.
    const olderLater = hotScore(counts({ voteCount: 500 }), at(604_800));
    const newerLater = hotScore(counts({ voteCount: 20 }), at(3 * TIME_CONSTANT_SECONDS + 604_800));
    expect(newerLater - olderLater).toBeCloseTo(gap, 5);
  });

  it('treats one order of magnitude of engagement as roughly a day of freshness', () => {
    const engaged = hotScore(counts({ voteCount: 100 }), at(0));
    const freshButQuiet = hotScore(counts({ voteCount: 10 }), at(TIME_CONSTANT_SECONDS));
    expect(Math.abs(engaged - freshButQuiet)).toBeLessThan(0.01);
  });

  it('never returns -Infinity for a duel with no engagement', () => {
    expect(Number.isFinite(hotScore(counts(), at(0)))).toBe(true);
  });

  it('falls back to now when a duel has no publish date', () => {
    expect(Number.isFinite(hotScore(counts({ voteCount: 3 }), null))).toBe(true);
  });
});
