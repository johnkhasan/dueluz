import { prisma } from '@dueluz/db';
import { AppError } from '@/lib/errors';
import { decodeCursor, paginate } from '@/lib/cursor';
import { assertNotSpam, cleanText } from '@/lib/sanitize';
import { hasRole, type SessionUser } from '../auth/guards';
import { recomputeHotScore } from '../trending/recompute';

export type CommentDto = {
  id: string;
  content: string;
  likeCount: number;
  createdAt: string;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null };
  liked: boolean;
  canDelete: boolean;
};

const commentSelect = {
  id: true,
  content: true,
  likeCount: true,
  createdAt: true,
  userId: true,
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
} as const;

export async function listComments(
  duelId: string,
  viewer: SessionUser | null,
  options: { cursor?: string; limit?: number } = {},
): Promise<{ items: CommentDto[]; nextCursor: string | null }> {
  const limit = options.limit ?? 20;
  const cursor = decodeCursor(options.cursor);

  const rows = await prisma.comment.findMany({
    where: {
      duelId,
      status: 'VISIBLE',
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.value) } },
              { createdAt: new Date(cursor.value), id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: commentSelect,
  });

  const { items, nextCursor } = paginate(rows, limit, (row) => ({
    value: row.createdAt.toISOString(),
    id: row.id,
  }));

  const likedIds = viewer
    ? new Set(
        (
          await prisma.commentLike.findMany({
            where: { commentId: { in: items.map((row) => row.id) }, userId: viewer.id },
            select: { commentId: true },
          })
        ).map((like) => like.commentId),
      )
    : new Set<string>();

  return {
    items: items.map((row) => ({
      id: row.id,
      content: row.content,
      likeCount: row.likeCount,
      createdAt: row.createdAt.toISOString(),
      author: row.user,
      liked: likedIds.has(row.id),
      canDelete: !!viewer && (viewer.id === row.userId || hasRole(viewer, 'MODERATOR')),
    })),
    nextCursor,
  };
}

export async function createComment(
  duelId: string,
  author: SessionUser,
  rawContent: string,
): Promise<CommentDto> {
  const content = cleanText(rawContent);
  if (!content) throw new AppError('VALIDATION_ERROR', 'Comment cannot be empty');
  if (content.length > 1000) throw new AppError('COMMENT_TOO_LONG', 'Comment is too long');
  assertNotSpam(content, { maxLinks: 1 });

  const duel = await prisma.duel.findUnique({ where: { id: duelId }, select: { status: true } });
  if (!duel || duel.status !== 'PUBLISHED') throw new AppError('DUEL_NOT_FOUND');

  // Duplicate-post guard: the same text twice in a row is almost always a
  // double submit or a bot.
  const previous = await prisma.comment.findFirst({
    where: { duelId, userId: author.id, status: 'VISIBLE' },
    orderBy: { createdAt: 'desc' },
    select: { content: true },
  });
  if (previous?.content === content) {
    throw new AppError('SPAM_DETECTED', 'You already posted that comment');
  }

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: { duelId, userId: author.id, content },
      select: commentSelect,
    });
    await tx.duel.update({ where: { id: duelId }, data: { commentCount: { increment: 1 } } });
    await recomputeHotScore(tx, duelId);
    return created;
  });

  return {
    id: row.id,
    content: row.content,
    likeCount: 0,
    createdAt: row.createdAt.toISOString(),
    author: row.user,
    liked: false,
    canDelete: true,
  };
}

export async function deleteComment(commentId: string, viewer: SessionUser): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, duelId: true, status: true },
  });
  if (!comment || comment.status === 'DELETED') throw new AppError('COMMENT_NOT_FOUND');

  if (comment.userId !== viewer.id && !hasRole(viewer, 'MODERATOR')) {
    throw new AppError('FORBIDDEN', 'You can only delete your own comments');
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.update({ where: { id: commentId }, data: { status: 'DELETED' } });
    if (comment.status === 'VISIBLE') {
      await tx.duel.update({
        where: { id: comment.duelId },
        data: { commentCount: { decrement: 1 } },
      });
      await recomputeHotScore(tx, comment.duelId);
    }
  });
}
