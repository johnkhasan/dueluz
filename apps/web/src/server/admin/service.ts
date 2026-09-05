import {
  prisma,
  type CommentStatus,
  type DuelStatus,
  type ReportStatus,
  type Role,
} from '@dueluz/db';
import { AppError } from '@/lib/errors';
import { decodeCursor, paginate } from '@/lib/cursor';
import { cleanLine } from '@/lib/sanitize';
import { destroyAllSessions } from '../auth/session';
import { dailySeries, weeklyMeaningfulVoters } from '../analytics/service';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function dashboardStats() {
  const dayAgo = new Date(Date.now() - 86_400_000);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [users, duels, votes, comments, pendingReports, newUsers24h, votes24h, duels7d, wmv] =
    await Promise.all([
      prisma.user.count(),
      prisma.duel.count({ where: { status: { not: 'DELETED' } } }),
      prisma.vote.count(),
      prisma.comment.count({ where: { status: 'VISIBLE' } }),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.vote.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.duel.count({ where: { createdAt: { gte: weekAgo }, status: { not: 'DELETED' } } }),
      weeklyMeaningfulVoters(),
    ]);

  return {
    users,
    duels,
    votes,
    comments,
    pendingReports,
    newUsers24h,
    votes24h,
    duels7d,
    weeklyMeaningfulVoters: wmv,
  };
}

export async function analyticsOverview(days = 14) {
  const [votes, duelViews, duelsCreated, registrations, shares, topDuels] = await Promise.all([
    dailySeries('vote', days),
    dailySeries('duel_view', days),
    dailySeries('duel_created', days),
    dailySeries('registration', days),
    dailySeries('duel_shared', days),
    prisma.duel.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { voteCount: 'desc' },
      take: 10,
      select: {
        id: true,
        slug: true,
        title: true,
        voteCount: true,
        commentCount: true,
        shareCount: true,
        viewCount: true,
      },
    }),
  ]);

  return { votes, duelViews, duelsCreated, registrations, shares, topDuels };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listUsers(options: { q?: string; cursor?: string; limit?: number } = {}) {
  const limit = options.limit ?? 25;
  const cursor = decodeCursor(options.cursor);

  const rows = await prisma.user.findMany({
    where: {
      ...(options.q
        ? {
            OR: [
              { username: { contains: options.q, mode: 'insensitive' } },
              { email: { contains: options.q, mode: 'insensitive' } },
              { displayName: { contains: options.q, mode: 'insensitive' } },
            ],
          }
        : {}),
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
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      status: true,
      bannedUntil: true,
      createdAt: true,
      _count: { select: { duels: true, votes: true, comments: true } },
    },
  });

  return paginate(rows, limit, (row) => ({
    value: row.createdAt.toISOString(),
    id: row.id,
  }));
}

export async function moderateUser(
  targetId: string,
  actor: { id: string; role: Role },
  action: 'BAN' | 'UNBAN' | 'PROMOTE' | 'DEMOTE',
  options: { reason?: string; days?: number } = {},
) {
  if (targetId === actor.id) {
    throw new AppError('FORBIDDEN', 'You cannot moderate your own account');
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });
  if (!target) throw new AppError('NOT_FOUND', 'User not found');

  // Only an ADMIN can act on another privileged account, and nobody can touch
  // an ADMIN through this endpoint.
  if (target.role === 'ADMIN') {
    throw new AppError('FORBIDDEN', 'Administrators cannot be moderated here');
  }
  if (target.role === 'MODERATOR' && actor.role !== 'ADMIN') {
    throw new AppError('FORBIDDEN', 'Only an administrator can moderate a moderator');
  }
  if ((action === 'PROMOTE' || action === 'DEMOTE') && actor.role !== 'ADMIN') {
    throw new AppError('FORBIDDEN', 'Only an administrator can change roles');
  }

  switch (action) {
    case 'BAN': {
      const bannedUntil = options.days
        ? new Date(Date.now() + options.days * 86_400_000)
        : null;
      await prisma.user.update({
        where: { id: targetId },
        data: {
          status: 'BANNED',
          bannedUntil,
          banReason: options.reason ? cleanLine(options.reason) : null,
        },
      });
      // A ban must take effect immediately, not when the cookie expires.
      await destroyAllSessions(targetId);
      break;
    }
    case 'UNBAN':
      await prisma.user.update({
        where: { id: targetId },
        data: { status: 'ACTIVE', bannedUntil: null, banReason: null },
      });
      break;
    case 'PROMOTE':
      await prisma.user.update({ where: { id: targetId }, data: { role: 'MODERATOR' } });
      break;
    case 'DEMOTE':
      await prisma.user.update({ where: { id: targetId }, data: { role: 'USER' } });
      break;
  }
}

// ---------------------------------------------------------------------------
// Duels
// ---------------------------------------------------------------------------

export async function listDuelsAdmin(
  options: { status?: DuelStatus; q?: string; cursor?: string; limit?: number } = {},
) {
  const limit = options.limit ?? 25;
  const cursor = decodeCursor(options.cursor);

  const rows = await prisma.duel.findMany({
    where: {
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { searchText: { contains: options.q.toLowerCase() } } : {}),
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
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      voteCount: true,
      commentCount: true,
      createdAt: true,
      moderationNote: true,
      author: { select: { id: true, username: true, displayName: true } },
      category: { select: { slug: true, emoji: true, nameEn: true } },
      options: { orderBy: { position: 'asc' }, select: { name: true } },
      _count: { select: { reports: true } },
    },
  });

  return paginate(rows, limit, (row) => ({
    value: row.createdAt.toISOString(),
    id: row.id,
  }));
}

export async function moderateDuel(
  duelId: string,
  action: 'HIDE' | 'RESTORE' | 'DELETE',
  note?: string,
) {
  const duel = await prisma.duel.findUnique({
    where: { id: duelId },
    select: { id: true, status: true, categoryId: true, publishedAt: true },
  });
  if (!duel) throw new AppError('DUEL_NOT_FOUND');

  const nextStatus: DuelStatus =
    action === 'HIDE' ? 'HIDDEN' : action === 'RESTORE' ? 'PUBLISHED' : 'DELETED';

  const wasCounted = duel.status === 'PUBLISHED' || duel.status === 'HIDDEN';
  const willCount = nextStatus === 'PUBLISHED' || nextStatus === 'HIDDEN';

  await prisma.$transaction(async (tx) => {
    await tx.duel.update({
      where: { id: duelId },
      data: {
        status: nextStatus,
        moderationNote: note ? cleanLine(note) : null,
        // A duel restored from DELETED may never have had a publish date.
        ...(nextStatus === 'PUBLISHED' && !duel.publishedAt
          ? { publishedAt: new Date() }
          : {}),
      },
    });

    if (wasCounted !== willCount) {
      await tx.category.update({
        where: { id: duel.categoryId },
        data: { duelCount: willCount ? { increment: 1 } : { decrement: 1 } },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function listCommentsAdmin(
  options: { status?: CommentStatus; cursor?: string; limit?: number } = {},
) {
  const limit = options.limit ?? 25;
  const cursor = decodeCursor(options.cursor);

  const rows = await prisma.comment.findMany({
    where: {
      ...(options.status ? { status: options.status } : { status: { not: 'DELETED' } }),
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
    select: {
      id: true,
      content: true,
      status: true,
      likeCount: true,
      createdAt: true,
      user: { select: { id: true, username: true, displayName: true } },
      duel: { select: { id: true, slug: true, title: true } },
      _count: { select: { reports: true } },
    },
  });

  return paginate(rows, limit, (row) => ({
    value: row.createdAt.toISOString(),
    id: row.id,
  }));
}

export async function moderateComment(commentId: string, action: 'HIDE' | 'RESTORE' | 'DELETE') {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, status: true, duelId: true },
  });
  if (!comment) throw new AppError('COMMENT_NOT_FOUND');

  const nextStatus: CommentStatus =
    action === 'HIDE' ? 'HIDDEN' : action === 'RESTORE' ? 'VISIBLE' : 'DELETED';

  const wasVisible = comment.status === 'VISIBLE';
  const willBeVisible = nextStatus === 'VISIBLE';

  await prisma.$transaction(async (tx) => {
    await tx.comment.update({ where: { id: commentId }, data: { status: nextStatus } });
    if (wasVisible !== willBeVisible) {
      await tx.duel.update({
        where: { id: comment.duelId },
        data: { commentCount: willBeVisible ? { increment: 1 } : { decrement: 1 } },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function listReports(
  options: { status?: ReportStatus; cursor?: string; limit?: number } = {},
) {
  const limit = options.limit ?? 25;
  const cursor = decodeCursor(options.cursor);

  const rows = await prisma.report.findMany({
    where: {
      status: options.status ?? 'PENDING',
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
    select: {
      id: true,
      targetType: true,
      reason: true,
      details: true,
      status: true,
      createdAt: true,
      reporter: { select: { id: true, username: true } },
      duel: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          options: { orderBy: { position: 'asc' }, select: { name: true } },
        },
      },
      comment: {
        select: {
          id: true,
          content: true,
          status: true,
          duel: { select: { slug: true, title: true } },
          user: { select: { id: true, username: true } },
        },
      },
    },
  });

  return paginate(rows, limit, (row) => ({
    value: row.createdAt.toISOString(),
    id: row.id,
  }));
}

export async function resolveReport(
  reportId: string,
  resolverId: string,
  action: 'RESOLVE' | 'DISMISS',
  note?: string,
) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true },
  });
  if (!report) throw new AppError('REPORT_NOT_FOUND', 'Report not found');

  await prisma.report.update({
    where: { id: reportId },
    data: {
      status: action === 'RESOLVE' ? 'RESOLVED' : 'DISMISSED',
      resolutionNote: note ? cleanLine(note) : null,
      resolvedById: resolverId,
      resolvedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function listCategoriesAdmin() {
  return prisma.category.findMany({ orderBy: [{ position: 'asc' }, { nameEn: 'asc' }] });
}

export async function createCategory(input: {
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  emoji: string;
  color: string;
  position: number;
  isActive: boolean;
}) {
  const existing = await prisma.category.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError('CONFLICT', 'A category with that slug already exists');
  return prisma.category.create({ data: input });
}

export async function updateCategory(id: string, input: Partial<Parameters<typeof createCategory>[0]>) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError('CATEGORY_NOT_FOUND');
  return prisma.category.update({ where: { id }, data: input });
}

/**
 * Categories are never hard-deleted while duels reference them (the foreign key
 * is RESTRICT); an in-use category is deactivated instead, which hides it from
 * the create form without orphaning content.
 */
export async function deleteCategory(id: string) {
  const inUse = await prisma.duel.count({ where: { categoryId: id } });
  if (inUse > 0) {
    await prisma.category.update({ where: { id }, data: { isActive: false } });
    return { deactivated: true };
  }
  await prisma.category.delete({ where: { id } });
  return { deactivated: false };
}
