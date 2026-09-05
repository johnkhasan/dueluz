import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@dueluz/db';
import { castVote, findExistingVote } from '@/server/votes/service';
import { AppError } from '@/lib/errors';
import { makeCategory, makeDuel, makeUser, resetDatabase } from './helpers';

let categoryId: string;

beforeEach(async () => {
  await resetDatabase();
  categoryId = (await makeCategory()).id;
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('castVote', () => {
  it('records the vote and updates both counters in one transaction', async () => {
    const duel = await makeDuel(categoryId);
    const optionA = duel.options[0]!;

    const result = await castVote(duel.id, optionA.id, { anonId: 'anon-1' });

    expect(result.totalVotes).toBe(1);
    expect(result.votedOptionId).toBe(optionA.id);
    expect(result.inMajority).toBe(true);

    const fresh = await prisma.duel.findUniqueOrThrow({
      where: { id: duel.id },
      include: { options: { orderBy: { position: 'asc' } } },
    });
    expect(fresh.voteCount).toBe(1);
    expect(fresh.options[0]!.voteCount).toBe(1);
    expect(fresh.options[1]!.voteCount).toBe(0);
  });

  it('rejects a second vote from the same anonymous session', async () => {
    const duel = await makeDuel(categoryId);
    await castVote(duel.id, duel.options[0]!.id, { anonId: 'anon-1' });

    await expect(castVote(duel.id, duel.options[1]!.id, { anonId: 'anon-1' })).rejects.toMatchObject(
      { code: 'ALREADY_VOTED' },
    );

    const fresh = await prisma.duel.findUniqueOrThrow({ where: { id: duel.id } });
    expect(fresh.voteCount).toBe(1);
  });

  it('rejects a second vote from the same account', async () => {
    const duel = await makeDuel(categoryId);
    const user = await makeUser();

    await castVote(duel.id, duel.options[0]!.id, { userId: user.id });
    await expect(castVote(duel.id, duel.options[0]!.id, { userId: user.id })).rejects.toMatchObject({
      code: 'ALREADY_VOTED',
    });
  });

  /**
   * The uniqueness guarantee lives in the database, not in a read-then-write
   * check, so simultaneous requests cannot both slip through.
   */
  it('lets exactly one of many simultaneous votes win', async () => {
    const duel = await makeDuel(categoryId);

    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        castVote(duel.id, duel.options[index % 2]!.id, { anonId: 'racer' }),
      ),
    );

    const fulfilled = attempts.filter((attempt) => attempt.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    for (const attempt of attempts) {
      if (attempt.status === 'rejected') {
        expect((attempt.reason as AppError).code).toBe('ALREADY_VOTED');
      }
    }

    const fresh = await prisma.duel.findUniqueOrThrow({
      where: { id: duel.id },
      include: { options: true },
    });
    expect(fresh.voteCount).toBe(1);
    expect(fresh.options.reduce((sum, option) => sum + option.voteCount, 0)).toBe(1);
  });

  it('keeps counters exact under concurrent votes from different voters', async () => {
    const duel = await makeDuel(categoryId);

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        castVote(duel.id, duel.options[index % 2]!.id, { anonId: `voter-${index}` }),
      ),
    );

    const fresh = await prisma.duel.findUniqueOrThrow({
      where: { id: duel.id },
      include: { options: { orderBy: { position: 'asc' } } },
    });
    expect(fresh.voteCount).toBe(20);
    expect(fresh.options[0]!.voteCount).toBe(10);
    expect(fresh.options[1]!.voteCount).toBe(10);
  });

  it('refuses an option that belongs to a different duel', async () => {
    const duel = await makeDuel(categoryId);
    const other = await makeDuel(categoryId);

    await expect(
      castVote(duel.id, other.options[0]!.id, { anonId: 'anon-1' }),
    ).rejects.toMatchObject({ code: 'OPTION_NOT_FOUND' });

    expect((await prisma.vote.count())).toBe(0);
  });

  it('refuses to vote on a hidden duel', async () => {
    const duel = await makeDuel(categoryId);
    await prisma.duel.update({ where: { id: duel.id }, data: { status: 'HIDDEN' } });

    await expect(
      castVote(duel.id, duel.options[0]!.id, { anonId: 'anon-1' }),
    ).rejects.toMatchObject({ code: 'DUEL_NOT_PUBLISHED' });
  });

  it('refuses a vote with no identity at all', async () => {
    const duel = await makeDuel(categoryId);
    await expect(castVote(duel.id, duel.options[0]!.id, {})).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('never stores a raw IP address', async () => {
    const duel = await makeDuel(categoryId);
    await castVote(duel.id, duel.options[0]!.id, { anonId: 'anon-1', ipHash: 'abc123hash' });

    const vote = await prisma.vote.findFirstOrThrow();
    expect(vote.ipHash).toBe('abc123hash');
    expect(vote.ipHash).not.toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it('raises the hot score as engagement arrives', async () => {
    const duel = await makeDuel(categoryId);
    const before = (await prisma.duel.findUniqueOrThrow({ where: { id: duel.id } })).hotScore;

    for (let index = 0; index < 25; index += 1) {
      await castVote(duel.id, duel.options[0]!.id, { anonId: `voter-${index}` });
    }

    const after = (await prisma.duel.findUniqueOrThrow({ where: { id: duel.id } })).hotScore;
    expect(after).toBeGreaterThan(before);
  });

  it('reports minority status honestly', async () => {
    const duel = await makeDuel(categoryId);
    for (let index = 0; index < 3; index += 1) {
      await castVote(duel.id, duel.options[0]!.id, { anonId: `majority-${index}` });
    }

    const result = await castVote(duel.id, duel.options[1]!.id, { anonId: 'lonely' });
    expect(result.inMajority).toBe(false);
    expect(result.isTie).toBe(false);
    expect(result.options.map((option) => option.percentage)).toEqual([75, 25]);
  });
});

describe('findExistingVote', () => {
  it('finds the viewer own vote and nobody else', async () => {
    const duel = await makeDuel(categoryId);
    await castVote(duel.id, duel.options[0]!.id, { anonId: 'anon-1' });

    expect(await findExistingVote(duel.id, { anonId: 'anon-1' })).toBe(duel.options[0]!.id);
    expect(await findExistingVote(duel.id, { anonId: 'anon-2' })).toBeNull();
    expect(await findExistingVote(duel.id, {})).toBeNull();
  });
});
