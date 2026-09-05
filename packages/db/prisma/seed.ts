/**
 * Development seed.
 *
 * Creates the category taxonomy, a handful of demo accounts and a realistic set
 * of duels with votes, likes and comments, so the feeds, trending ordering and
 * admin dashboard all have something meaningful to show on a fresh install.
 *
 * Safe to re-run: every write is an upsert or is skipped when data exists.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
// Single source of truth for the ranking formula.
import { hotScore } from '../../../apps/web/src/server/trending/score';

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: 'technology', nameUz: 'Texnologiya', nameRu: 'Технологии', nameEn: 'Technology', emoji: '💻', color: '#6366f1' },
  { slug: 'sports', nameUz: 'Sport', nameRu: 'Спорт', nameEn: 'Sports', emoji: '⚽', color: '#22c55e' },
  { slug: 'food', nameUz: 'Ovqat', nameRu: 'Еда', nameEn: 'Food', emoji: '🍔', color: '#f97316' },
  { slug: 'movies', nameUz: 'Kino', nameRu: 'Кино', nameEn: 'Movies', emoji: '🎬', color: '#a855f7' },
  { slug: 'music', nameUz: 'Musiqa', nameRu: 'Музыка', nameEn: 'Music', emoji: '🎵', color: '#ec4899' },
  { slug: 'gaming', nameUz: 'Gaming', nameRu: 'Игры', nameEn: 'Gaming', emoji: '🎮', color: '#8b5cf6' },
  { slug: 'fashion', nameUz: 'Moda', nameRu: 'Мода', nameEn: 'Fashion', emoji: '👟', color: '#f43f5e' },
  { slug: 'cars', nameUz: 'Avtomobil', nameRu: 'Авто', nameEn: 'Cars', emoji: '🚗', color: '#0ea5e9' },
  { slug: 'travel', nameUz: 'Sayohat', nameRu: 'Путешествия', nameEn: 'Travel', emoji: '✈️', color: '#14b8a6' },
  { slug: 'education', nameUz: "Ta'lim", nameRu: 'Образование', nameEn: 'Education', emoji: '📚', color: '#eab308' },
  { slug: 'lifestyle', nameUz: 'Turmush', nameRu: 'Образ жизни', nameEn: 'Lifestyle', emoji: '🌿', color: '#10b981' },
  { slug: 'other', nameUz: 'Boshqa', nameRu: 'Другое', nameEn: 'Other', emoji: '✨', color: '#64748b' },
];

/**
 * Demo accounts. Their `telegramId`s are deliberately far outside the range
 * Telegram allocates, so a real Telegram user can never collide with one and
 * inherit a seeded account.
 */
const USERS = [
  { username: 'javohir', displayName: 'Javohir Hasanov', telegramId: 'seed-1', telegramUsername: 'javohir', bio: 'Duel.uz asoschisi. Texnologiya va futbol.' },
  { username: 'malika', displayName: 'Malika Yusupova', telegramId: 'seed-2', telegramUsername: 'malika', bio: 'Kino va musiqa haqida bahslashishni yaxshi ko\'raman.' },
  { username: 'sardor', displayName: 'Sardor Rahimov', telegramId: 'seed-3', telegramUsername: 'sardor', bio: 'Gamer. PC master race.' },
  { username: 'nilufar', displayName: 'Nilufar Karimova', telegramId: 'seed-4', telegramUsername: 'nilufar', bio: 'Sayohat, ovqat, hayot.' },
  { username: 'bekzod', displayName: 'Bekzod Tursunov', telegramId: 'seed-5', telegramUsername: 'bekzod', bio: 'Avtomobillar va sport.' },
];

type DuelSeed = {
  category: string;
  title: string;
  a: string;
  b: string;
  description?: string;
  /** Roughly how popular this duel is, 0..1. Drives generated engagement. */
  heat: number;
  /** How many days ago it was published. */
  ageDays: number;
};

const DUELS: DuelSeed[] = [
  { category: 'technology', title: 'Qaysi telefon yaxshiroq?', a: 'iPhone 17 Pro', b: 'Samsung Galaxy S26 Ultra', heat: 1.0, ageDays: 1, description: 'Kamera, batareya va narx - hammasini hisobga oling.' },
  { category: 'technology', title: 'Frontend uchun qaysi biri?', a: 'React', b: 'Vue', heat: 0.72, ageDays: 3 },
  { category: 'technology', title: 'Qaysi operatsion tizim?', a: 'macOS', b: 'Windows', heat: 0.65, ageDays: 6 },
  { category: 'technology', title: 'Backend tili', a: 'TypeScript', b: 'Go', heat: 0.55, ageDays: 9 },
  { category: 'technology', title: 'Qaysi noutbuk?', a: 'MacBook Pro', b: 'ThinkPad', heat: 0.48, ageDays: 12 },
  { category: 'sports', title: 'Barcha zamonlarning eng zo\'ri', a: 'Messi', b: 'Ronaldo', heat: 0.98, ageDays: 2, description: 'Klassik bahs. Bir marta ovoz bering.' },
  { category: 'sports', title: 'Qaysi klub kuchliroq?', a: 'Real Madrid', b: 'Barcelona', heat: 0.8, ageDays: 4 },
  { category: 'sports', title: 'Qaysi sport qiziqarliroq?', a: 'Futbol', b: 'Basketbol', heat: 0.42, ageDays: 11 },
  { category: 'sports', title: 'Kurash turlari', a: 'Boks', b: 'MMA', heat: 0.38, ageDays: 15 },
  { category: 'food', title: 'Qaysi ichimlik?', a: 'Coca-Cola', b: 'Pepsi', heat: 0.75, ageDays: 2 },
  { category: 'food', title: 'Milliy taom', a: 'Osh', b: 'Somsa', heat: 0.92, ageDays: 1, description: 'Eng qiyin tanlov.' },
  { category: 'food', title: 'Nonushta uchun', a: 'Choy', b: 'Qahva', heat: 0.6, ageDays: 5 },
  { category: 'food', title: 'Qaysi fast food?', a: 'Burger', b: 'Pizza', heat: 0.5, ageDays: 8 },
  { category: 'movies', title: 'Qaysi trilogiya?', a: 'The Lord of the Rings', b: 'Star Wars', heat: 0.58, ageDays: 7 },
  { category: 'movies', title: 'Super qahramonlar', a: 'Marvel', b: 'DC', heat: 0.7, ageDays: 3 },
  { category: 'movies', title: 'Rejissyor', a: 'Nolan', b: 'Tarantino', heat: 0.45, ageDays: 10 },
  { category: 'music', title: 'Qaysi janr?', a: 'Pop', b: 'Rok', heat: 0.4, ageDays: 13 },
  { category: 'music', title: 'Musiqa platformasi', a: 'Spotify', b: 'YouTube Music', heat: 0.52, ageDays: 6 },
  { category: 'music', title: 'O\'zbek estradasi', a: 'Yulduz Usmonova', b: 'Sevara Nazarxon', heat: 0.35, ageDays: 16 },
  { category: 'gaming', title: 'Qaysi platforma?', a: 'PlayStation 5', b: 'Xbox Series X', heat: 0.68, ageDays: 4 },
  { category: 'gaming', title: 'Qaysi o\'yin?', a: 'Dota 2', b: 'League of Legends', heat: 0.62, ageDays: 5 },
  { category: 'gaming', title: 'Mobil o\'yin', a: 'PUBG Mobile', b: 'Free Fire', heat: 0.56, ageDays: 8 },
  { category: 'gaming', title: 'Gaming setup', a: 'PC', b: 'Konsol', heat: 0.44, ageDays: 14 },
  { category: 'fashion', title: 'Krossovka brendi', a: 'Nike', b: 'Adidas', heat: 0.66, ageDays: 3 },
  { category: 'fashion', title: 'Kundalik kiyim', a: 'Jinsi', b: 'Sport shim', heat: 0.3, ageDays: 18 },
  { category: 'cars', title: 'Qaysi avtomobil?', a: 'Tesla Model 3', b: 'BMW i4', heat: 0.54, ageDays: 6 },
  { category: 'cars', title: 'O\'zbekistonda', a: 'Chevrolet Cobalt', b: 'Chevrolet Nexia 3', heat: 0.71, ageDays: 2 },
  { category: 'cars', title: 'Kelajak', a: 'Elektromobil', b: 'Benzin', heat: 0.47, ageDays: 9 },
  { category: 'travel', title: 'Dam olish uchun', a: 'Dengiz', b: 'Tog\'', heat: 0.63, ageDays: 4 },
  { category: 'travel', title: 'O\'zbekiston shaharlari', a: 'Samarqand', b: 'Buxoro', heat: 0.85, ageDays: 2, description: 'Ikkalasi ham go\'zal, lekin bittasini tanlang.' },
  { category: 'travel', title: 'Sayohat uslubi', a: 'Backpacking', b: 'Hotel', heat: 0.28, ageDays: 20 },
  { category: 'education', title: 'O\'qish formati', a: 'Online', b: 'Offline', heat: 0.5, ageDays: 7 },
  { category: 'education', title: 'Til o\'rganish', a: 'Ingliz tili', b: 'Rus tili', heat: 0.58, ageDays: 5 },
  { category: 'lifestyle', title: 'Kun tartibi', a: 'Erta turish', b: 'Kech yotish', heat: 0.46, ageDays: 10 },
  { category: 'lifestyle', title: 'Sport turi', a: 'Yugurish', b: 'Sport zal', heat: 0.41, ageDays: 12 },
  { category: 'other', title: 'Qaysi biri?', a: 'It', b: 'Mushuk', heat: 0.88, ageDays: 1 },
];

const COMMENTS = [
  'Bu juda qiyin tanlov bo\'ldi!',
  'Menimcha javob aniq.',
  'Ikkalasi ham zo\'r, lekin men birinchisini tanladim.',
  'Natijalar meni hayron qoldirdi.',
  'Do\'stlarimga ham yubordim.',
  'Согласен с большинством.',
  'Interesting split here.',
  'Bu haqda uzoq bahslashish mumkin.',
  'Narx-sifat nisbatida ikkinchisi yaxshiroq.',
  'Men ozchilikdaman shekilli :)',
];

/** Deterministic pseudo-random so re-seeding produces the same fixture. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

async function main() {
  const random = makeRandom(42);
  console.log('Seeding Duel.uz...');

  // --- categories ---------------------------------------------------------
  const categories = new Map<string, string>();
  for (const [index, category] of CATEGORIES.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { ...category, position: index },
      create: { ...category, position: index },
    });
    categories.set(category.slug, row.id);
  }
  console.log(`  categories: ${categories.size}`);

  // --- users --------------------------------------------------------------
  // Sign-in is Telegram-only, so the admin account is claimed by Telegram id
  // rather than by a seeded password. Set SEED_ADMIN_TELEGRAM_ID to your own id
  // (@userinfobot tells you what it is) and the first login lands on ADMIN.
  // `|| undefined`, not `?.trim()` alone: the shipped .env sets it to an empty
  // string, which must not become an empty telegram id.
  const adminTelegramId = process.env.SEED_ADMIN_TELEGRAM_ID?.trim() || undefined;

  // Keyed by username, not by Telegram id: re-seeding must also re-point an
  // account that already exists under a different (or missing) id.
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { role: 'ADMIN', telegramId: adminTelegramId ?? 'seed-admin' },
    create: {
      telegramId: adminTelegramId ?? 'seed-admin',
      username: 'admin',
      displayName: 'Duel.uz Admin',
      role: 'ADMIN',
      bio: 'Platforma moderatori.',
    },
  });

  const users = [admin];
  for (const user of USERS) {
    users.push(
      await prisma.user.upsert({
        where: { username: user.username },
        update: { telegramId: user.telegramId, telegramUsername: user.telegramUsername },
        create: user,
      }),
    );
  }
  console.log(
    `  users: ${users.length} (admin telegram id: ${adminTelegramId ?? 'unset - set SEED_ADMIN_TELEGRAM_ID to claim it'})`,
  );

  // --- duels --------------------------------------------------------------
  if ((await prisma.duel.count()) > 0) {
    console.log('  duels already present - skipping content seed');
    return;
  }

  let duelCount = 0;
  let voteTotal = 0;

  for (const seed of DUELS) {
    const categoryId = categories.get(seed.category);
    if (!categoryId) continue;

    const author = users[Math.floor(random() * users.length)] ?? admin;
    const publishedAt = new Date(Date.now() - seed.ageDays * 86_400_000);
    const category = CATEGORIES.find((item) => item.slug === seed.category)!;

    // Engagement generated from `heat`, with a lopsided split so results look
    // like real opinions rather than a coin flip.
    const totalVotes = Math.round(20 + seed.heat * seed.heat * 900 * (0.6 + random() * 0.8));
    const splitA = 0.3 + random() * 0.45;
    const votesA = Math.round(totalVotes * splitA);
    const votesB = totalVotes - votesA;
    const likeCount = Math.round(totalVotes * (0.05 + random() * 0.12));
    const shareCount = Math.round(totalVotes * (0.01 + random() * 0.05));
    const commentTexts = COMMENTS.slice(0, Math.round(random() * 5));

    const counts = {
      voteCount: totalVotes,
      likeCount,
      commentCount: commentTexts.length,
      shareCount,
    };

    const duel = await prisma.duel.create({
      data: {
        slug: `${slugify(`${seed.a}-vs-${seed.b}`)}-${Math.floor(random() * 1e6)
          .toString(36)
          .padStart(4, '0')}`,
        title: seed.title,
        description: seed.description ?? null,
        authorId: author.id,
        categoryId,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        publishedAt,
        createdAt: publishedAt,
        viewCount: Math.round(totalVotes * (2 + random() * 4)),
        searchText: `${seed.title} ${seed.a} ${seed.b} ${category.nameEn} ${category.nameUz} ${category.nameRu}`.toLowerCase(),
        ...counts,
        hotScore: hotScore(counts, publishedAt),
        options: {
          create: [
            { name: seed.a, position: 0, voteCount: votesA },
            { name: seed.b, position: 1, voteCount: votesB },
          ],
        },
      },
      select: { id: true, options: { orderBy: { position: 'asc' }, select: { id: true } } },
    });

    // Real vote rows for the demo accounts so "already voted" states and the
    // Weekly Meaningful Voters metric are exercised.
    const voteRows: Prisma.VoteCreateManyInput[] = [];
    for (const user of users) {
      if (random() > 0.55) continue;
      const optionId = duel.options[random() > splitA ? 1 : 0]?.id;
      if (!optionId) continue;
      voteRows.push({
        duelId: duel.id,
        optionId,
        userId: user.id,
        createdAt: new Date(publishedAt.getTime() + random() * 86_400_000),
      });
    }
    if (voteRows.length > 0) {
      await prisma.vote.createMany({ data: voteRows, skipDuplicates: true });
    }

    for (const [index, content] of commentTexts.entries()) {
      const user = users[Math.floor(random() * users.length)] ?? admin;
      await prisma.comment.create({
        data: {
          duelId: duel.id,
          userId: user.id,
          content,
          likeCount: Math.round(random() * 12),
          createdAt: new Date(publishedAt.getTime() + (index + 1) * 3_600_000),
        },
      });
    }

    duelCount += 1;
    voteTotal += totalVotes;
  }

  for (const [slug, id] of categories) {
    const count = await prisma.duel.count({ where: { categoryId: id, status: 'PUBLISHED' } });
    await prisma.category.update({ where: { id }, data: { duelCount: count } });
    void slug;
  }

  // One pending report so the moderation queue is not empty on first login.
  const firstDuel = await prisma.duel.findFirst({ select: { id: true } });
  if (firstDuel) {
    await prisma.report.create({
      data: {
        targetType: 'DUEL',
        duelId: firstDuel.id,
        reason: 'SPAM',
        details: 'Demo report so the moderation queue is not empty.',
        reporterId: users[1]?.id ?? null,
      },
    });
  }

  console.log(`  duels: ${duelCount}, simulated votes: ${voteTotal}`);
  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
