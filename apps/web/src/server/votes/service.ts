import { isUniqueViolation, prisma } from '@dueluz/db';
import { AppError } from '@/lib/errors';
import { votePercentages } from '@/lib/utils';
import { recomputeHotScore } from '../trending/recompute';

export type VoterIdentity = {
  userId?: string | null;
  anonId?: string | null;
  ipHash?: string | null;
};

export type VoteResult = {
  duelId: string;
  votedOptionId: string;
  totalVotes: number;
  options: { id: string; name: string; voteCount: number; percentage: number }[];
  /** True when the viewer's pick is currently ahead. Drives the share prompt. */
  inMajority: boolean;
  isTie: boolean;
};

/**
 * Records one vote.
 *
 * Correctness properties:
 *  - Uniqueness is enforced by the database, not by a read-then-write check,
 *    so two simultaneous requests can never both succeed.
 *  - Counter updates and the vote row are in one transaction, so a crash can
 *    never leave a vote without its count or the reverse.
 *  - The option is re-checked against the duel server-side; a client cannot
 *    vote for an option belonging to a different duel.
 */
export async function castVote(
  duelId: string,
  optionId: string,
  identity: VoterIdentity,
): Promise<VoteResult> {
  if (!identity.userId && !identity.anonId) {
    throw new AppError('BAD_REQUEST', 'No voter identity');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const duel = await tx.duel.findUnique({
        where: { id: duelId },
        select: {
          id: true,
          status: true,
          options: { orderBy: { position: 'asc' }, select: { id: true, name: true } },
        },
      });

      if (!duel || duel.status === 'DELETED') throw new AppError('DUEL_NOT_FOUND');
      if (duel.status !== 'PUBLISHED') {
        throw new AppError('DUEL_NOT_PUBLISHED', 'This duel is not open for voting');
      }
      if (!duel.options.some((option) => option.id === optionId)) {
        throw new AppError('OPTION_NOT_FOUND', 'That option does not belong to this duel');
      }

      await tx.vote.create({
        data: {
          duelId,
          optionId,
          userId: identity.userId ?? null,
          anonId: identity.userId ? null : (identity.anonId ?? null),
          ipHash: identity.ipHash ?? null,
        },
      });

      await tx.duelOption.update({
        where: { id: optionId },
        data: { voteCount: { increment: 1 } },
      });

      // Takes the duel row lock; everything read afterwards in this transaction
      // reflects the post-increment state.
      await tx.duel.update({ where: { id: duelId }, data: { voteCount: { increment: 1 } } });
      await recomputeHotScore(tx, duelId);

      const fresh = await tx.duel.findUniqueOrThrow({
        where: { id: duelId },
        select: {
          voteCount: true,
          options: {
            orderBy: { position: 'asc' },
            select: { id: true, name: true, voteCount: true },
          },
        },
      });

      return buildResult(duelId, optionId, fresh);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('ALREADY_VOTED', 'You have already voted on this duel');
    }
    throw error;
  }
}

function buildResult(
  duelId: string,
  votedOptionId: string,
  duel: {
    voteCount: number;
    options: { id: string; name: string; voteCount: number }[];
  },
): VoteResult {
  const [first, second] = duel.options;
  const [percentA, percentB] = votePercentages(first?.voteCount ?? 0, second?.voteCount ?? 0);
  const percentages = [percentA, percentB];

  const options = duel.options.map((option, index) => ({
    id: option.id,
    name: option.name,
    voteCount: option.voteCount,
    percentage: percentages[index] ?? 0,
  }));

  const best = Math.max(...options.map((option) => option.voteCount));
  const leaders = options.filter((option) => option.voteCount === best);
  const picked = options.find((option) => option.id === votedOptionId);

  return {
    duelId,
    votedOptionId,
    totalVotes: duel.voteCount,
    options,
    isTie: leaders.length > 1,
    inMajority: leaders.length === 1 && picked?.id === leaders[0]?.id,
  };
}

/** The viewer's existing vote on a duel, if any. */
export async function findExistingVote(
  duelId: string,
  identity: VoterIdentity,
): Promise<string | null> {
  const where = identity.userId
    ? { duelId, userId: identity.userId }
    : identity.anonId
      ? { duelId, anonId: identity.anonId }
      : null;
  if (!where) return null;

  const vote = await prisma.vote.findFirst({ where, select: { optionId: true } });
  return vote?.optionId ?? null;
}
