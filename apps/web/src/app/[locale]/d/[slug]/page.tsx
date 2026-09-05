import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { AppError } from '@/lib/errors';
import { isLocale, localeTags, locales, type Locale } from '@/lib/i18n/config';
import { getDictionary, interpolate } from '@/lib/i18n/dictionary';
import { absoluteUrl } from '@/lib/request';
import { APP_NAME } from '@/lib/env';
import { CommentSection } from '@/components/duel/comment-section';
import { DuelCard } from '@/components/duel/duel-card';
import { DuelDetail } from '@/components/duel/duel-detail';
import { listCategories, localiseCategory } from '@/server/categories/service';
import { getViewer } from '@/server/context';
import { getDuelBySlug, recordView, relatedDuels } from '@/server/duels/service';
import { prisma } from '@dueluz/db';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

/** Server-rendered metadata is what makes a shared link show a real preview. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const t = getDictionary(locale);

  const duel = await prisma.duel.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      voteCount: true,
      status: true,
      publishedAt: true,
      options: { orderBy: { position: 'asc' }, select: { name: true } },
    },
  });

  if (!duel || duel.status !== 'PUBLISHED') {
    return { title: t.duel.notFound, robots: { index: false, follow: false } };
  }

  const [a, b] = duel.options;
  const title = `${a?.name ?? ''} vs ${b?.name ?? ''} - ${t.seo.duelTitleSuffix}`;
  const description =
    duel.description ||
    interpolate(t.seo.duelDescription, {
      a: a?.name ?? '',
      b: b?.name ?? '',
      votes: duel.voteCount,
    });

  const path = `/${locale}/d/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: Object.fromEntries(
        locales.map((code) => [localeTags[code], `/${code}/d/${slug}`]),
      ),
    },
    openGraph: {
      type: 'article',
      siteName: APP_NAME,
      locale: localeTags[locale],
      title,
      description,
      url: path,
      publishedTime: duel.publishedAt?.toISOString(),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function DuelPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const t = getDictionary(locale);

  const viewer = await getViewer();
  const identity = { userId: viewer.user?.id, anonId: viewer.anonId };

  let duel;
  try {
    duel = await getDuelBySlug(slug, identity);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }

  const [categories, related] = await Promise.all([
    listCategories(locale),
    relatedDuels(duel, identity, 4),
    recordView(duel.id, identity),
  ]);

  const categoryNames = Object.fromEntries(categories.map((item) => [item.slug, item.name]));
  const categoryName =
    categoryNames[duel.category.slug] ?? localiseCategory(duel.category, locale);
  const url = absoluteUrl(`/${locale}/d/${slug}`);

  const [optionA, optionB] = duel.options;

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-fg-subtle flex items-center gap-1 text-xs">
        <Link href={`/${locale}`} className="hover:text-fg transition-colors">
          {t.nav.home}
        </Link>
        <ChevronRight className="size-3" />
        <Link
          href={`/${locale}/explore?category=${duel.category.slug}`}
          className="hover:text-fg transition-colors"
        >
          {categoryName}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-fg-muted truncate">{duel.title}</span>
      </nav>

      <DuelDetail duel={duel} categoryName={categoryName} url={url} />

      <CommentSection duelId={duel.id} initialCount={duel.commentCount} anchorId="comments" />

      {related.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-fg text-lg font-bold tracking-tight">{t.duel.relatedDuels}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((item) => (
              <DuelCard
                key={item.id}
                duel={item}
                categoryName={categoryNames[item.category.slug] ?? item.category.slug}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Structured data so search engines can render the duel as a Q&A. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Question',
            name: duel.title,
            text: duel.description ?? duel.title,
            answerCount: duel.options.length,
            upvoteCount: duel.voteCount,
            datePublished: duel.publishedAt,
            author: duel.author
              ? { '@type': 'Person', name: duel.author.displayName }
              : { '@type': 'Organization', name: APP_NAME },
            suggestedAnswer: [optionA, optionB].filter(Boolean).map((option) => ({
              '@type': 'Answer',
              text: option?.name,
              upvoteCount: option?.voteCount ?? 0,
              url: `${url}#${option?.id}`,
            })),
          }),
        }}
      />
    </div>
  );
}
