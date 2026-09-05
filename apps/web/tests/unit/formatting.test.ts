import { describe, expect, it } from 'vitest';
import { formatCount, formatDate, formatRelativeTime, votePercentages } from '@/lib/utils';
import { decodeCursor, encodeCursor, paginate } from '@/lib/cursor';
import { buildDuelSlug, normaliseUsername, slugify, usernameFromEmail } from '@/lib/slug';

describe('votePercentages', () => {
  it('always sums to exactly 100', () => {
    for (const [a, b] of [
      [1, 2],
      [67, 33],
      [1, 0],
      [999, 1],
      [7, 13],
      [12_345, 54_321],
    ]) {
      const [left, right] = votePercentages(a as number, b as number);
      expect(left + right).toBe(100);
    }
  });

  it('shows an even split before any vote', () => {
    expect(votePercentages(0, 0)).toEqual([50, 50]);
  });

  it('gives the rounding remainder to the second side rather than showing 33/68', () => {
    expect(votePercentages(1, 2)).toEqual([33, 67]);
  });
});

describe('formatCount', () => {
  /**
   * Browsers ship no `uz-UZ` compact-notation data, so Intl would render
   * "12.8K" in Chrome and "12,8 ming" in Node - a hydration mismatch and wrong
   * Uzbek. These assertions lock in the hand-rolled behaviour.
   */
  it('formats Uzbek compact counts without Intl', () => {
    expect(formatCount(999, 'uz')).toBe('999');
    expect(formatCount(1000, 'uz')).toBe('1 ming');
    expect(formatCount(12_842, 'uz')).toBe('12,8 ming');
    expect(formatCount(1_250_000, 'uz')).toBe('1,3 mln');
    expect(formatCount(12_842, 'uz-UZ')).toBe('12,8 ming');
  });

  it('leaves small numbers untouched in every locale', () => {
    expect(formatCount(0, 'en')).toBe('0');
    expect(formatCount(42, 'ru')).toBe('42');
  });
});

describe('formatDate / formatRelativeTime', () => {
  it('formats Uzbek dates consistently', () => {
    expect(formatDate('2026-09-04T10:00:00.000Z', 'uz')).toMatch(/^\d{1,2}-sen, 2026$/);
  });

  it('formats Uzbek relative times in Uzbek, not English', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    expect(formatRelativeTime(twoHoursAgo, 'uz')).toBe('2 soat oldin');

    const justNow = new Date(Date.now() - 5000);
    expect(formatRelativeTime(justNow, 'uz')).toBe('hozirgina');
  });
});

describe('cursor', () => {
  it('round-trips a cursor', () => {
    const cursor = { value: '2026-09-05T10:00:00.000Z', id: 'cmto6gsw700c6' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('handles values that themselves contain the separator', () => {
    const cursor = { value: 'a|b|c', id: 'xyz' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('rejects a tampered cursor instead of returning garbage', () => {
    expect(() => decodeCursor('not-a-valid-cursor!!')).toThrow();
  });

  it('returns null for a missing cursor', () => {
    expect(decodeCursor(undefined)).toBeNull();
  });

  it('splits an over-fetched page and emits the next cursor', () => {
    const rows = [1, 2, 3, 4].map((n) => ({ id: `id${n}`, value: `v${n}` }));
    const page = paginate(rows, 3, (row) => ({ value: row.value, id: row.id }));

    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeCursor(page.nextCursor)).toEqual({ value: 'v3', id: 'id3' });
  });

  it('emits no cursor on the last page', () => {
    const rows = [{ id: 'a', value: 'v' }];
    expect(paginate(rows, 3, (row) => ({ value: row.value, id: row.id })).nextCursor).toBeNull();
  });
});

describe('slugify', () => {
  it('transliterates Uzbek and Russian titles', () => {
    expect(slugify('Салом Дунё')).toBe('salom-dunyo');
    expect(slugify("O'zbekiston")).toBe('ozbekiston');
    expect(slugify('Самарқанд')).toBe('samarqand');
  });

  it('strips punctuation and collapses separators', () => {
    expect(slugify('iPhone 17 Pro  ---  Max!!!')).toBe('iphone-17-pro-max');
  });

  it('never leaves a leading or trailing dash', () => {
    expect(slugify('  ...hello...  ')).toBe('hello');
  });

  it('builds a readable, non-enumerable duel slug', () => {
    const slug = buildDuelSlug('Which phone?', 'iPhone 17 Pro', 'Galaxy S26');
    expect(slug).toMatch(/^iphone-17-pro-vs-galaxy-s26-[a-z0-9]{6}$/);
  });

  it('still produces a slug when the options are non-Latin', () => {
    expect(buildDuelSlug('Savol', '!!!', '???')).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('usernames', () => {
  it('normalises to the allowed alphabet', () => {
    expect(normaliseUsername('  Javohir.Hasanov! ')).toBe('javohirhasanov');
  });

  it('derives a usable username from an email', () => {
    expect(usernameFromEmail('javohir.hasanov@duel.uz')).toBe('javohirhasanov');
    expect(usernameFromEmail('!!!@duel.uz')).toBe('user');
  });
});
