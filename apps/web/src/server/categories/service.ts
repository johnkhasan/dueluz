import { prisma } from '@dueluz/db';
import type { Locale } from '@/lib/i18n/config';
import { cacheGet, cacheSet } from '@/lib/redis';

export type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  color: string;
  duelCount: number;
};

type CategoryRow = {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  emoji: string;
  color: string;
  duelCount: number;
};

const CACHE_KEY = 'categories:active';
const CACHE_TTL = 300;

export function localiseCategory(
  row: Pick<CategoryRow, 'nameUz' | 'nameRu' | 'nameEn'>,
  locale: Locale,
): string {
  if (locale === 'ru') return row.nameRu;
  if (locale === 'en') return row.nameEn;
  return row.nameUz;
}

/** Active categories, cached for five minutes — they change very rarely. */
export async function listCategories(locale: Locale): Promise<CategoryDto[]> {
  const cached = await cacheGet<CategoryRow[]>(CACHE_KEY);
  const rows =
    cached ??
    (await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { nameEn: 'asc' }],
      select: {
        id: true,
        slug: true,
        nameUz: true,
        nameRu: true,
        nameEn: true,
        emoji: true,
        color: true,
        duelCount: true,
      },
    }));

  if (!cached) await cacheSet(CACHE_KEY, rows, CACHE_TTL);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: localiseCategory(row, locale),
    emoji: row.emoji,
    color: row.color,
    duelCount: row.duelCount,
  }));
}

export async function findCategoryBySlug(slug: string, locale: Locale): Promise<CategoryDto | null> {
  const categories = await listCategories(locale);
  return categories.find((category) => category.slug === slug) ?? null;
}
