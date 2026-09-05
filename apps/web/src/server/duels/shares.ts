import { prisma, type ShareChannel } from '@dueluz/db';
import { AppError } from '@/lib/errors';
import { recomputeHotScore } from '../trending/recompute';

/**
 * Records a share. Shares are the highest-weighted engagement signal, so this
 * feeds straight back into the trending score.
 */
export async function recordShare(
  duelId: string,
  channel: ShareChannel,
  identity: { userId?: string | null; anonId?: string | null },
): Promise<{ shareCount: number }> {
  const duel = await prisma.duel.findUnique({ where: { id: duelId }, select: { status: true } });
  if (!duel || duel.status !== 'PUBLISHED') throw new AppError('DUEL_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    await tx.share.create({
      data: {
        duelId,
        channel,
        userId: identity.userId ?? null,
        anonId: identity.userId ? null : (identity.anonId ?? null),
      },
    });
    const updated = await tx.duel.update({
      where: { id: duelId },
      data: { shareCount: { increment: 1 } },
      select: { shareCount: true },
    });
    await recomputeHotScore(tx, duelId);
    return { shareCount: updated.shareCount };
  });
}
