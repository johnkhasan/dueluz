import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryChips } from '@/components/duel/category-chips';
import { DuelFeed } from '@/components/duel/duel-feed';
import { FeedTabs } from '@/components/duel/feed-tabs';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { formatCount } from '@/lib/utils';
import { FEEDS, type Feed } from '@/lib/validation';
import { listCategories } from '@/server/categories/service';
import { getViewer } from '@/server/context';
import { listDuels } from '@/server/duels/service';
import { prisma } from '@dueluz/db';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ feed?: string; category?: string }>;
};

export default async function HomePage({ params, searchParams }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const { feed: rawFeed, category } = await searchParams;

  const feed: Feed = FEEDS.includes(rawFeed as Feed) ? (rawFeed as Feed) : 'trending';
  const t = getDictionary(locale);

  const [viewer, categories] = await Promise.all([getViewer(), listCategories(locale)]);

  const [{ items, nextCursor }, totals] = await Promise.all([
    listDuels(
      { feed, category, limit: 12 },
      { userId: viewer.user?.id, anonId: viewer.anonId },
    ),
    prisma.duel
      .aggregate({ where: { status: 'PUBLISHED' }, _count: true, _sum: { voteCount: true } })
      .catch(() => null),
  ]);

  const categoryNames = Object.fromEntries(categories.map((item) => [item.slug, item.name]));

  return (
    <div className="space-y-6">
      {!viewer.user ? <Hero locale={locale} t={t} totals={totals} /> : null}

      <div className="flex flex-col gap-4">
        <FeedTabs active={feed} />
        <CategoryChips
          categories={categories}
          active={category}
          basePath={`/${locale}`}
          extraQuery={{ feed: feed === 'trending' ? undefined : feed }}
        />
      </div>

      <DuelFeed
        initialDuels={items}
        initialCursor={nextCursor}
        params={{ feed, category }}
        categoryNames={categoryNames}
        empty={{
          title: t.home.empty,
          hint: t.home.emptyHint,
          actionHref: `/${locale}/create`,
          actionLabel: t.home.heroCta,
        }}
      />
    </div>
  );
}

function Hero({
  locale,
  t,
  totals,
}: {
  locale: Locale;
  t: ReturnType<typeof getDictionary>;
  totals: { _count: number; _sum: { voteCount: number | null } } | null;
}) {
  return (
    <section className="border-border bg-surface shadow-card relative overflow-hidden rounded-3xl border p-6 sm:p-10">
      <div
        aria-hidden
        className="brand-gradient pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-15 blur-3xl"
      />

      <div className="relative max-w-xl">
        <span className="bg-accent/10 text-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
          <Sparkles className="size-3.5" />
          {t.common.tagline}
        </span>

        <h1 className="text-fg mt-4 text-3xl font-black tracking-tight text-balance sm:text-5xl">
          {t.home.heroTitle}
        </h1>
        <p className="text-fg-muted mt-3 text-base text-pretty sm:text-lg">{t.home.heroSubtitle}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href={`/${locale}/create`}>
            <Button size="lg">
              {t.home.heroCta}
              <ArrowRight className="size-4" />
            </Button>
          </Link>

          {totals ? (
            <p className="text-fg-subtle text-sm font-medium">
              {formatCount(totals._count, locale)} {t.home.statsDuels} ·{' '}
              {formatCount(totals._sum.voteCount ?? 0, locale)} {t.home.statsVotes}
            </p>
          ) : null}
        </div>

        <p className="text-fg-subtle mt-4 text-xs">{t.auth.anonymousNote}</p>
      </div>
    </section>
  );
}
