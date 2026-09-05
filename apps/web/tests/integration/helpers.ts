import { prisma } from '@dueluz/db';
import { hotScore } from '@/server/trending/score';

/** Wipes every table between test files. Safe: this runs against TEST_DATABASE_URL. */
export async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "analytics_events", "notifications", "reports", "shares",
      "comment_likes", "comments", "duel_likes", "votes",
      "duel_options", "duels", "sessions", "users", "categories"
    RESTART IDENTITY CASCADE
  `);
}

export async function makeCategory(slug = 'technology') {
  return prisma.category.create({
    data: {
      slug,
      nameUz: 'Texnologiya',
      nameRu: 'Технологии',
      nameEn: 'Technology',
      emoji: '💻',
      color: '#6366f1',
    },
  });
}

let userCounter = 0;

export async function makeUser(over: { role?: 'USER' | 'MODERATOR' | 'ADMIN' } = {}) {
  userCounter += 1;
  return prisma.user.create({
    data: {
      telegramId: `test-${userCounter}`,
      telegramUsername: `user${userCounter}`,
      username: `user${userCounter}`,
      displayName: `User ${userCounter}`,
      role: over.role ?? 'USER',
    },
  });
}

let duelCounter = 0;

export async function makeDuel(categoryId: string, authorId?: string) {
  duelCounter += 1;
  const publishedAt = new Date();

  return prisma.duel.create({
    data: {
      slug: `duel-${duelCounter}-${Date.now()}`,
      title: `Duel number ${duelCounter}`,
      categoryId,
      authorId: authorId ?? null,
      status: 'PUBLISHED',
      publishedAt,
      searchText: `duel number ${duelCounter} alpha beta technology`,
      hotScore: hotScore({ voteCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 }, publishedAt),
      options: {
        create: [
          { name: 'Alpha', position: 0 },
          { name: 'Beta', position: 1 },
        ],
      },
    },
    include: { options: { orderBy: { position: 'asc' } } },
  });
}
