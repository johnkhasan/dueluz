import { isUniqueViolation, prisma } from '@dueluz/db';
import { AppError } from '@/lib/errors';
import { recomputeHotScore } from '../trending/recompute';

export type LikeResult = { liked: boolean; likeCount: number };

/** Idempotent: liking twice is a no-op rather than an error. */
export async function likeDuel(duelId: string, userId: string): Promise<LikeResult> {
  const duel = await prisma.duel.findUnique({ where: { id: duelId }, select: { status: true } });
  if (!duel || duel.status !== 'PUBLISHED') throw new AppError('DUEL_NOT_FOUND');

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.duelLike.create({ data: { duelId, userId } });
      const updated = await tx.duel.update({
        where: { id: duelId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      await recomputeHotScore(tx, duelId);
      return { liked: true, likeCount: updated.likeCount };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const duelRow = await prisma.duel.findUniqueOrThrow({
        where: { id: duelId },
        select: { likeCount: true },
      });
      return { liked: true, likeCount: duelRow.likeCount };
    }
    throw error;
  }
}

export async function unlikeDuel(duelId: string, userId: string): Promise<LikeResult> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.duelLike.deleteMany({ where: { duelId, userId } });
    if (count === 0) {
      const row = await tx.duel.findUniqueOrThrow({
        where: { id: duelId },
        select: { likeCount: true },
      });
      return { liked: false, likeCount: row.likeCount };
    }

    const updated = await tx.duel.update({
      where: { id: duelId },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true },
    });
    await recomputeHotScore(tx, duelId);
    return { liked: false, likeCount: updated.likeCount };
  });
}

export async function likeComment(commentId: string, userId: string): Promise<LikeResult> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { status: true },
  });
  if (!comment || comment.status !== 'VISIBLE') throw new AppError('COMMENT_NOT_FOUND');

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.commentLike.create({ data: { commentId, userId } });
      const updated = await tx.comment.update({
        where: { id: commentId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      return { liked: true, likeCount: updated.likeCount };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }

  // Already liked -> toggle off.
  return prisma.$transaction(async (tx) => {
    await tx.commentLike.deleteMany({ where: { commentId, userId } });
    const updated = await tx.comment.update({
      where: { id: commentId },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true },
    });
    return { liked: false, likeCount: updated.likeCount };
  });
}
