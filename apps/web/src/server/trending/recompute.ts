import { Prisma, prisma } from '@dueluz/db';
import { hotScore } from './score';

/** Any Prisma client — the shared one or a transaction handle. */
export type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Recomputes and stores a duel's hot score.
 *
 * Must be called inside the same transaction as the counter change that
 * triggered it: that transaction already holds the row lock from its own
 * UPDATE, so the counts read here are exactly the post-update values and no
 * concurrent vote can interleave.
 */
export async function recomputeHotScore(db: Db, duelId: string): Promise<number> {
  const duel = await db.duel.findUnique({
    where: { id: duelId },
    select: {
      voteCount: true,
      likeCount: true,
      commentCount: true,
      shareCount: true,
      publishedAt: true,
    },
  });
  if (!duel) return 0;

  const score = hotScore(duel, duel.publishedAt);
  await db.duel.update({ where: { id: duelId }, data: { hotScore: score } });
  return score;
}
