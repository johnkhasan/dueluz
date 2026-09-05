import type { MetadataRoute } from 'next';
import { prisma } from '@dueluz/db';
import { APP_URL } from '@/lib/env';
import { locales } from '@/lib/i18n/config';

/**
 * Generated per request rather than at build time.
 *
 * The sitemap lists live duels, so prerendering it would both freeze the list
 * at build time and require a reachable database during `docker build`.
 * Crawlers fetch this a handful of times a day, so the query cost is nil.
 */
export const dynamic = 'force-dynamic';

/** Cap so the sitemap stays inside the 50k-URL / 50MB limits. */
const MAX_DUELS = 10_000;

/**
 * One entry per duel per locale, with `alternates.languages` so search engines
 * treat the three translations as the same page rather than duplicates.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [duels, categories] = await Promise.all([
    prisma.duel.findMany({
      where: { status: 'PUBLISHED', visibility: 'PUBLIC' },
      orderBy: { publishedAt: 'desc' },
      take: MAX_DUELS,
      select: { slug: true, updatedAt: true },
    }),
    prisma.category.findMany({ where: { isActive: true }, select: { slug: true } }),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  const staticPaths = ['', '/explore', '/create'];
  for (const path of staticPaths) {
    for (const locale of locales) {
      entries.push({
        url: `${APP_URL}/${locale}${path}`,
        changeFrequency: path === '' ? 'hourly' : 'daily',
        priority: path === '' ? 1 : 0.7,
        alternates: {
          languages: Object.fromEntries(
            locales.map((code) => [code, `${APP_URL}/${code}${path}`]),
          ),
        },
      });
    }
  }

  for (const category of categories) {
    for (const locale of locales) {
      entries.push({
        url: `${APP_URL}/${locale}/explore?category=${category.slug}`,
        changeFrequency: 'daily',
        priority: 0.6,
      });
    }
  }

  for (const duel of duels) {
    for (const locale of locales) {
      entries.push({
        url: `${APP_URL}/${locale}/d/${duel.slug}`,
        lastModified: duel.updatedAt,
        changeFrequency: 'daily',
        priority: 0.8,
        alternates: {
          languages: Object.fromEntries(
            locales.map((code) => [code, `${APP_URL}/${code}/d/${duel.slug}`]),
          ),
        },
      });
    }
  }

  return entries;
}
