import type { Metadata } from 'next';
import { CategoryChips } from '@/components/duel/category-chips';
import { DuelFeed } from '@/components/duel/duel-feed';
import { SearchBar } from '@/components/duel/search-bar';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { listCategories } from '@/server/categories/service';
import { getViewer } from '@/server/context';
import { listDuels } from '@/server/duels/service';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : 'uz');
  return {
    title: t.seo.exploreTitle,
    description: t.seo.exploreDescription,
    alternates: { canonical: `/${locale}/explore` },
  };
}

export default async function ExplorePage({ params, searchParams }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const { q, category } = await searchParams;
  const t = getDictionary(locale);

  const [viewer, categories] = await Promise.all([getViewer(), listCategories(locale)]);
  const { items, nextCursor } = await listDuels(
    { feed: q ? 'popular' : 'trending', q, category, limit: 12 },
    { userId: viewer.user?.id, anonId: viewer.anonId },
  );

  const categoryNames = Object.fromEntries(categories.map((item) => [item.slug, item.name]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-fg text-2xl font-black tracking-tight">{t.explore.title}</h1>
        <p className="text-fg-muted mt-1 text-sm">{t.seo.exploreDescription}</p>
      </div>

      <SearchBar initialValue={q} category={category} basePath={`/${locale}/explore`} />

      <CategoryChips
        categories={categories}
        active={category}
        basePath={`/${locale}/explore`}
        extraQuery={{ q }}
      />

      {q ? (
        <p className="text-fg-muted text-sm">
          <span className="font-semibold">{t.explore.resultsFor}</span> {q}
        </p>
      ) : null}

      <DuelFeed
        key={`${q ?? ''}:${category ?? ''}`}
        initialDuels={items}
        initialCursor={nextCursor}
        params={{ feed: q ? 'popular' : 'trending', q, category }}
        categoryNames={categoryNames}
        empty={{
          title: q ? t.explore.noResults : t.home.empty,
          hint: q ? t.explore.noResultsHint : t.home.emptyHint,
          actionHref: `/${locale}/create`,
          actionLabel: t.home.heroCta,
        }}
      />
    </div>
  );
}
