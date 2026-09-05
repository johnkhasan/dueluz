import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@dueluz/db';
import { createDuel, deleteDuel, getDuelBySlug, listDuels } from '@/server/duels/service';
import { castVote } from '@/server/votes/service';
import { decodeCursor } from '@/lib/cursor';
import { makeCategory, makeDuel, makeUser, resetDatabase } from './helpers';

let categoryId: string;
let authorId: string;

beforeEach(async () => {
  await resetDatabase();
  categoryId = (await makeCategory()).id;
  authorId = (await makeUser()).id;
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

const query = (over: Partial<Parameters<typeof listDuels>[0]> = {}) => ({
  feed: 'trending' as const,
  limit: 12,
  ...over,
});

describe('createDuel', () => {
  it('publishes a duel with a readable, unique slug', async () => {
    const duel = await createDuel(
      {
        title: 'Which phone is better?',
        categoryId,
        visibility: 'PUBLIC',
        optionA: { name: 'iPhone 17 Pro' },
        optionB: { name: 'Galaxy S26 Ultra' },
      },
      authorId,
    );

    expect(duel.slug).toMatch(/^iphone-17-pro-vs-galaxy-s26-ultra-[a-z0-9]{6}$/);
    expect(duel.status).toBe('PUBLISHED');
    expect(duel.options.map((option) => option.name)).toEqual([
      'iPhone 17 Pro',
      'Galaxy S26 Ultra',
    ]);
    expect(duel.voteCount).toBe(0);
  });

  it('indexes the duel for search across title, options and category', async () => {
    await createDuel(
      {
        title: 'Which phone is better?',
        categoryId,
        visibility: 'PUBLIC',
        optionA: { name: 'iPhone 17 Pro' },
        optionB: { name: 'Galaxy S26 Ultra' },
      },
      authorId,
    );

    for (const needle of ['iphone', 'galaxy s26', 'phone', 'technology', 'texnologiya']) {
      const found = await listDuels(query({ q: needle }), {});
      expect(found.items, `expected a match for "${needle}"`).toHaveLength(1);
    }
  });

  it('rejects an unknown or inactive category', async () => {
    await expect(
      createDuel(
        {
          title: 'A perfectly fine title',
          categoryId: 'does-not-exist',
          visibility: 'PUBLIC',
          optionA: { name: 'A' },
          optionB: { name: 'B' },
        },
        authorId,
      ),
    ).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
  });

  it('rejects a title that is spam', async () => {
    await expect(
      createDuel(
        {
          title: 'BUY NOW CHEAP OFFER TODAY',
          categoryId,
          visibility: 'PUBLIC',
          optionA: { name: 'A' },
          optionB: { name: 'B' },
        },
        authorId,
      ),
    ).rejects.toMatchObject({ code: 'SPAM_DETECTED' });
  });

  it('keeps the category duel count in step', async () => {
    await createDuel(
      {
        title: 'Which phone is better?',
        categoryId,
        visibility: 'PUBLIC',
        optionA: { name: 'A one' },
        optionB: { name: 'B two' },
      },
      authorId,
    );

    expect((await prisma.category.findUniqueOrThrow({ where: { id: categoryId } })).duelCount).toBe(1);
  });
});

describe('feeds', () => {
  it('hides duels that are not published', async () => {
    const visible = await makeDuel(categoryId);
    const hidden = await makeDuel(categoryId);
    await prisma.duel.update({ where: { id: hidden.id }, data: { status: 'HIDDEN' } });

    const { items } = await listDuels(query(), {});
    expect(items.map((duel) => duel.id)).toEqual([visible.id]);
  });

  it('hides unlisted duels from the feed but keeps them reachable by link', async () => {
    const unlisted = await makeDuel(categoryId);
    await prisma.duel.update({ where: { id: unlisted.id }, data: { visibility: 'UNLISTED' } });

    expect((await listDuels(query(), {})).items).toHaveLength(0);
    await expect(getDuelBySlug(unlisted.slug, {})).resolves.toMatchObject({ id: unlisted.id });
  });

  it('orders the popular feed by vote count', async () => {
    const quiet = await makeDuel(categoryId);
    const loud = await makeDuel(categoryId);

    for (let index = 0; index < 5; index += 1) {
      await castVote(loud.id, loud.options[0]!.id, { anonId: `v${index}` });
    }
    await castVote(quiet.id, quiet.options[0]!.id, { anonId: 'single' });

    const { items } = await listDuels(query({ feed: 'popular' }), {});
    expect(items.map((duel) => duel.id)).toEqual([loud.id, quiet.id]);
  });

  it('orders the new feed by publish time, newest first', async () => {
    const older = await makeDuel(categoryId);
    await prisma.duel.update({
      where: { id: older.id },
      data: { publishedAt: new Date(Date.now() - 86_400_000) },
    });
    const newer = await makeDuel(categoryId);

    const { items } = await listDuels(query({ feed: 'new' }), {});
    expect(items.map((duel) => duel.id)).toEqual([newer.id, older.id]);
  });

  it('pages through every duel exactly once with no repeats or gaps', async () => {
    const created: string[] = [];
    for (let index = 0; index < 7; index += 1) {
      created.push((await makeDuel(categoryId)).id);
    }

    const seen: string[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 5; page += 1) {
      const result = await listDuels(query({ feed: 'new', limit: 3, cursor }), {});
      seen.push(...result.items.map((duel) => duel.id));
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
      expect(decodeCursor(cursor)).not.toBeNull();
    }

    expect(seen).toHaveLength(created.length);
    expect(new Set(seen).size).toBe(created.length);
    expect([...seen].sort()).toEqual([...created].sort());
  });

  it('filters by category', async () => {
    const other = await makeCategory('sports');
    const tech = await makeDuel(categoryId);
    await makeDuel(other.id);

    const { items } = await listDuels(query({ category: 'technology' }), {});
    expect(items.map((duel) => duel.id)).toEqual([tech.id]);
  });

  it('matches every word of a multi-word search', async () => {
    const duel = await createDuel(
      {
        title: 'Which phone is better?',
        categoryId,
        visibility: 'PUBLIC',
        optionA: { name: 'iPhone 17 Pro' },
        optionB: { name: 'Galaxy S26 Ultra' },
      },
      authorId,
    );

    expect((await listDuels(query({ q: 'iphone galaxy' }), {})).items.map((d) => d.id)).toEqual([
      duel.id,
    ]);
    expect((await listDuels(query({ q: 'iphone nokia' }), {})).items).toHaveLength(0);
  });

  it('tells the viewer which side they picked', async () => {
    const duel = await makeDuel(categoryId);
    await castVote(duel.id, duel.options[1]!.id, { anonId: 'anon-1' });

    const mine = await listDuels(query(), { anonId: 'anon-1' });
    expect(mine.items[0]!.votedOptionId).toBe(duel.options[1]!.id);

    const theirs = await listDuels(query(), { anonId: 'anon-2' });
    expect(theirs.items[0]!.votedOptionId).toBeNull();
  });
});

describe('deleteDuel', () => {
  it('soft-deletes so moderation history survives, and removes it from view', async () => {
    const duel = await makeDuel(categoryId);
    await prisma.category.update({ where: { id: categoryId }, data: { duelCount: 1 } });

    await deleteDuel(duel.id);

    expect((await prisma.duel.findUniqueOrThrow({ where: { id: duel.id } })).status).toBe('DELETED');
    expect((await listDuels(query(), {})).items).toHaveLength(0);
    await expect(getDuelBySlug(duel.slug, {})).rejects.toMatchObject({ code: 'DUEL_NOT_FOUND' });
    expect(
      (await prisma.category.findUniqueOrThrow({ where: { id: categoryId } })).duelCount,
    ).toBe(0);
  });
});
