import { Prisma, isUniqueViolation, prisma, type DuelStatus } from '@dueluz/db';
import { AppError } from '@/lib/errors';
import { decodeCursor, encodeCursor, paginate } from '@/lib/cursor';
import { buildDuelSlug } from '@/lib/slug';
import { assertNotSpam, cleanLine, cleanText, toSearchText } from '@/lib/sanitize';
import { claimOnce } from '@/lib/redis';
import type { CreateDuelInput, FeedQuery } from '@/lib/validation';
import { hotScore } from '../trending/score';
import { duelSelect, toDuelDto, type DuelDto, type DuelRow } from './dto';

/** Identity of whoever is reading — used to attach "did I vote/like" flags. */
export type Viewer = { userId?: string | null; anonId?: string | null };

const PUBLIC_WHERE = { status: 'PUBLISHED' as DuelStatus, visibility: 'PUBLIC' as const };

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

type FeedResult = { items: DuelDto[]; nextCursor: string | null };

/**
 * Cursor-paginated feed.
 *
 * Each feed has a sort column plus `id` as a deterministic tiebreaker, and the
 * cursor carries both. Search adds a trigram filter on `search_text`.
 */
export async function listDuels(query: FeedQuery, viewer: Viewer): Promise<FeedResult> {
  const cursor = decodeCursor(query.cursor);
  const where: Prisma.DuelWhereInput = { ...PUBLIC_WHERE };

  if (query.category) {
    where.category = { slug: query.category };
  }
  if (query.author) {
    where.author = { username: { equals: query.author, mode: 'insensitive' } };
  }
  if (query.q) {
    // Every word must match, so "iphone samsung" finds the duel whose search
    // text is "iphone 17 pro samsung galaxy s26 ultra technology". Each ILIKE
    // is served by the pg_trgm GIN index on search_text.
    const words = toSearchText([query.q]).split(' ').filter(Boolean).slice(0, 5);
    if (words.length > 0) {
      where.AND = words.map((word) => ({ searchText: { contains: word } }));
    }
  }

  const { orderBy, keyOf, cursorFilter } = feedStrategy(query.feed, cursor);
  if (cursorFilter) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), cursorFilter];
  }

  const rows = await prisma.duel.findMany({
    where,
    orderBy,
    take: query.limit + 1,
    select: duelSelect,
  });

  const { items, nextCursor } = paginate(rows, query.limit, (row) => ({
    value: keyOf(row),
    id: row.id,
  }));

  return { items: await decorate(items, viewer), nextCursor };
}

type Strategy = {
  orderBy: Prisma.DuelOrderByWithRelationInput[];
  keyOf: (row: DuelRow) => string;
  cursorFilter: Prisma.DuelWhereInput | null;
};

/**
 * Keyset pagination for a `(sortColumn DESC, id DESC)` ordering:
 * take rows whose sort value is strictly smaller, or equal with a smaller id.
 */
function feedStrategy(feed: FeedQuery['feed'], cursor: { value: string; id: string } | null): Strategy {
  if (feed === 'new') {
    const at = cursor ? new Date(cursor.value) : null;
    return {
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      keyOf: (row) => (row.publishedAt ?? row.createdAt).toISOString(),
      cursorFilter: at
        ? {
            OR: [
              { publishedAt: { lt: at } },
              { publishedAt: at, id: { lt: cursor!.id } },
            ],
          }
        : null,
    };
  }

  if (feed === 'popular') {
    const votes = cursor ? Number(cursor.value) : null;
    return {
      orderBy: [{ voteCount: 'desc' }, { id: 'desc' }],
      keyOf: (row) => String(row.voteCount),
      cursorFilter:
        votes === null || Number.isNaN(votes)
          ? null
          : {
              OR: [{ voteCount: { lt: votes } }, { voteCount: votes, id: { lt: cursor!.id } }],
            },
    };
  }

  // trending
  const score = cursor ? Number(cursor.value) : null;
  return {
    orderBy: [{ hotScore: 'desc' }, { id: 'desc' }],
    keyOf: (row) => String(row.hotScore),
    cursorFilter:
      score === null || Number.isNaN(score)
        ? null
        : {
            OR: [{ hotScore: { lt: score } }, { hotScore: score, id: { lt: cursor!.id } }],
          },
  };
}

/** Attaches the viewer's own vote/like state to a page of duels in two queries. */
async function decorate(rows: DuelRow[], viewer: Viewer): Promise<DuelDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const identity = viewer.userId
    ? { userId: viewer.userId }
    : viewer.anonId
      ? { anonId: viewer.anonId }
      : null;

  const [votes, likes] = await Promise.all([
    identity
      ? prisma.vote.findMany({
          where: { duelId: { in: ids }, ...identity },
          select: { duelId: true, optionId: true },
        })
      : Promise.resolve([]),
    viewer.userId
      ? prisma.duelLike.findMany({
          where: { duelId: { in: ids }, userId: viewer.userId },
          select: { duelId: true },
        })
      : Promise.resolve([]),
  ]);

  const votedBy = new Map(votes.map((vote) => [vote.duelId, vote.optionId]));
  const likedSet = new Set(likes.map((like) => like.duelId));

  return rows.map((row) =>
    toDuelDto(row, {
      votedOptionId: votedBy.get(row.id) ?? null,
      liked: likedSet.has(row.id),
    }),
  );
}

export async function getDuelBySlug(slug: string, viewer: Viewer): Promise<DuelDto> {
  const row = await prisma.duel.findUnique({ where: { slug }, select: duelSelect });
  if (!row || row.status === 'DELETED') throw new AppError('DUEL_NOT_FOUND');
  if (row.status === 'HIDDEN') throw new AppError('DUEL_NOT_FOUND', 'This duel is not available');

  const [decorated] = await decorate([row], viewer);
  if (!decorated) throw new AppError('DUEL_NOT_FOUND');
  return decorated;
}

/** Loads a duel for its owner or a moderator, including hidden ones. */
export async function getDuelForOwner(id: string): Promise<DuelRow & { authorId: string | null }> {
  const row = await prisma.duel.findUnique({
    where: { id },
    select: { ...duelSelect, authorId: true },
  });
  if (!row || row.status === 'DELETED') throw new AppError('DUEL_NOT_FOUND');
  return row;
}

/** Same category first, then anything else recent. Never includes the duel itself. */
export async function relatedDuels(duel: DuelDto, viewer: Viewer, limit = 6): Promise<DuelDto[]> {
  const rows = await prisma.duel.findMany({
    where: {
      ...PUBLIC_WHERE,
      id: { not: duel.id },
      categoryId: duel.category.id,
    },
    orderBy: [{ hotScore: 'desc' }],
    take: limit,
    select: duelSelect,
  });

  if (rows.length >= limit) return decorate(rows, viewer);

  const filler = await prisma.duel.findMany({
    where: {
      ...PUBLIC_WHERE,
      id: { notIn: [duel.id, ...rows.map((row) => row.id)] },
    },
    orderBy: [{ hotScore: 'desc' }],
    take: limit - rows.length,
    select: duelSelect,
  });

  return decorate([...rows, ...filler], viewer);
}

/**
 * Increments the view counter at most once per viewer per hour.
 * Without Redis the counter is skipped rather than inflated on every refresh.
 */
export async function recordView(duelId: string, viewer: Viewer): Promise<void> {
  const identity = viewer.userId ?? viewer.anonId;
  if (!identity) return;
  if (!(await claimOnce(`view:${duelId}:${identity}`, 3600))) return;

  await prisma.duel.update({
    where: { id: duelId },
    data: { viewCount: { increment: 1 } },
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createDuel(input: CreateDuelInput, authorId: string): Promise<DuelDto> {
  const title = cleanLine(input.title);
  const optionA = cleanLine(input.optionA.name);
  const optionB = cleanLine(input.optionB.name);
  const description = input.description ? cleanText(input.description) : null;

  assertNotSpam(title, { maxLinks: 0 });
  assertNotSpam(`${optionA} ${optionB}`, { maxLinks: 0 });
  if (description) assertNotSpam(description, { maxLinks: 1 });

  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, isActive: true },
    select: { id: true, nameEn: true, nameRu: true, nameUz: true },
  });
  if (!category) throw new AppError('CATEGORY_NOT_FOUND', 'Choose a valid category');

  const publishedAt = new Date();
  const searchText = toSearchText([
    title,
    optionA,
    optionB,
    description,
    category.nameEn,
    category.nameRu,
    category.nameUz,
  ]);

  const create = (slug: string) =>
    prisma.duel.create({
      data: {
        slug,
        title,
        description,
        authorId,
        categoryId: category.id,
        status: 'PUBLISHED',
        visibility: input.visibility,
        publishedAt,
        searchText,
        hotScore: hotScore(
          { voteCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 },
          publishedAt,
        ),
        options: {
          create: [
            {
              name: optionA,
              imageUrl: input.optionA.imageUrl ?? null,
              imageKey: input.optionA.imageKey ?? null,
              position: 0,
            },
            {
              name: optionB,
              imageUrl: input.optionB.imageUrl ?? null,
              imageKey: input.optionB.imageKey ?? null,
              position: 1,
            },
          ],
        },
      },
      select: duelSelect,
    });

  let row: DuelRow;
  try {
    row = await create(buildDuelSlug(title, optionA, optionB));
  } catch (error) {
    // The random suffix makes a collision vanishingly unlikely; one retry with
    // a fresh suffix is enough to make it impossible in practice.
    if (!isUniqueViolation(error, 'slug')) throw error;
    row = await create(buildDuelSlug(title, optionA, optionB));
  }

  await prisma.category.update({
    where: { id: category.id },
    data: { duelCount: { increment: 1 } },
  });

  return toDuelDto(row);
}

export async function updateDuel(
  id: string,
  input: { title?: string; description?: string | null; categoryId?: string; visibility?: 'PUBLIC' | 'UNLISTED' },
): Promise<DuelDto> {
  const existing = await prisma.duel.findUnique({
    where: { id },
    select: {
      id: true,
      categoryId: true,
      title: true,
      description: true,
      options: { orderBy: { position: 'asc' }, select: { name: true } },
    },
  });
  if (!existing) throw new AppError('DUEL_NOT_FOUND');

  const title = input.title ? cleanLine(input.title) : existing.title;
  const description =
    input.description === undefined
      ? existing.description
      : input.description
        ? cleanText(input.description)
        : null;

  if (input.title) assertNotSpam(title, { maxLinks: 0 });
  if (description) assertNotSpam(description, { maxLinks: 1 });

  const categoryId = input.categoryId ?? existing.categoryId;
  const category = await prisma.category.findFirst({
    where: { id: categoryId, isActive: true },
    select: { id: true, nameEn: true, nameRu: true, nameUz: true },
  });
  if (!category) throw new AppError('CATEGORY_NOT_FOUND');

  const row = await prisma.duel.update({
    where: { id },
    data: {
      title,
      description,
      categoryId: category.id,
      ...(input.visibility ? { visibility: input.visibility } : {}),
      searchText: toSearchText([
        title,
        ...existing.options.map((option) => option.name),
        description,
        category.nameEn,
        category.nameRu,
        category.nameUz,
      ]),
    },
    select: duelSelect,
  });

  return toDuelDto(row);
}

/** Soft delete: the row stays for moderation history, but disappears everywhere. */
export async function deleteDuel(id: string): Promise<void> {
  const duel = await prisma.duel.findUnique({ where: { id }, select: { categoryId: true, status: true } });
  if (!duel || duel.status === 'DELETED') throw new AppError('DUEL_NOT_FOUND');

  await prisma.$transaction([
    prisma.duel.update({ where: { id }, data: { status: 'DELETED' } }),
    prisma.category.update({
      where: { id: duel.categoryId },
      data: { duelCount: { decrement: 1 } },
    }),
  ]);
}

/** Duels authored by a user, including hidden ones when they ask for their own. */
export async function listAuthoredDuels(
  authorId: string,
  options: { includeHidden?: boolean; cursor?: string; limit?: number } = {},
): Promise<FeedResult> {
  const limit = options.limit ?? 20;
  const cursor = decodeCursor(options.cursor);

  const rows = await prisma.duel.findMany({
    where: {
      authorId,
      status: options.includeHidden ? { not: 'DELETED' } : 'PUBLISHED',
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
    select: duelSelect,
  });

  const { items, nextCursor } = paginate(rows, limit, (row) => ({
    value: row.createdAt.toISOString(),
    id: row.id,
  }));

  return { items: items.map((row) => toDuelDto(row)), nextCursor };
}

export { encodeCursor };
