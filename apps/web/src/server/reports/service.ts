import { prisma, type ReportReason } from '@dueluz/db';
import { AppError } from '@/lib/errors';
import { cleanText } from '@/lib/sanitize';

type Reporter = { userId?: string | null; anonId?: string | null };

/** One report per target per reporter — repeat submissions are rejected. */
async function assertNotDuplicate(
  where: { duelId?: string; commentId?: string },
  reporter: Reporter,
): Promise<void> {
  const identity = reporter.userId
    ? { reporterId: reporter.userId }
    : reporter.anonId
      ? { reporterAnon: reporter.anonId }
      : null;
  if (!identity) return;

  const existing = await prisma.report.findFirst({
    where: { ...where, ...identity },
    select: { id: true },
  });
  if (existing) throw new AppError('ALREADY_REPORTED', 'You already reported this');
}

export async function reportDuel(
  duelId: string,
  reason: ReportReason,
  details: string | undefined,
  reporter: Reporter,
): Promise<void> {
  const duel = await prisma.duel.findUnique({ where: { id: duelId }, select: { status: true } });
  if (!duel || duel.status === 'DELETED') throw new AppError('DUEL_NOT_FOUND');

  await assertNotDuplicate({ duelId }, reporter);

  await prisma.report.create({
    data: {
      targetType: 'DUEL',
      duelId,
      reason,
      details: details ? cleanText(details) : null,
      reporterId: reporter.userId ?? null,
      reporterAnon: reporter.userId ? null : (reporter.anonId ?? null),
    },
  });
}

export async function reportComment(
  commentId: string,
  reason: ReportReason,
  details: string | undefined,
  reporter: Reporter,
): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { status: true },
  });
  if (!comment || comment.status === 'DELETED') throw new AppError('COMMENT_NOT_FOUND');

  await assertNotDuplicate({ commentId }, reporter);

  await prisma.report.create({
    data: {
      targetType: 'COMMENT',
      commentId,
      reason,
      details: details ? cleanText(details) : null,
      reporterId: reporter.userId ?? null,
      reporterAnon: reporter.userId ? null : (reporter.anonId ?? null),
    },
  });
}
