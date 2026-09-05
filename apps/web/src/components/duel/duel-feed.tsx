'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Swords } from 'lucide-react';
import Link from 'next/link';
import type { DuelDto } from '@/server/duels/dto';
import { Button } from '@/components/ui/button';
import { DuelCardSkeleton, EmptyState, ErrorState } from '@/components/ui/states';
import { useI18n } from '@/components/providers/i18n-provider';
import { ApiClientError, apiWithMeta } from '@/lib/client/api';
import { DuelCard } from './duel-card';

export type FeedParams = {
  feed?: 'trending' | 'new' | 'popular';
  category?: string;
  q?: string;
  author?: string;
};

type Props = {
  initialDuels: DuelDto[];
  initialCursor: string | null;
  params: FeedParams;
  /** category slug -> localised name, resolved on the server. */
  categoryNames: Record<string, string>;
  empty?: { title: string; hint?: string; actionHref?: string; actionLabel?: string };
};

function buildQuery(params: FeedParams, cursor: string | null): string {
  const search = new URLSearchParams();
  if (params.feed) search.set('feed', params.feed);
  if (params.category) search.set('category', params.category);
  if (params.q) search.set('q', params.q);
  if (params.author) search.set('author', params.author);
  if (cursor) search.set('cursor', cursor);
  return search.toString();
}

/**
 * Cursor-paginated feed with an auto-loading sentinel.
 *
 * The first page is rendered on the server (good LCP and indexable content);
 * subsequent pages are fetched client-side as the reader approaches the end.
 */
export function DuelFeed({ initialDuels, initialCursor, params, categoryNames, empty }: Props) {
  const { t, errorMessage } = useI18n();
  const [duels, setDuels] = useState(initialDuels);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // A new query (tab, category, search) replaces the list entirely.
  const key = buildQuery(params, null);
  const previousKey = useRef(key);
  useEffect(() => {
    if (previousKey.current === key) return;
    previousKey.current = key;
    setDuels(initialDuels);
    setCursor(initialCursor);
    setError(null);
  }, [key, initialDuels, initialCursor]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);

    try {
      const { data, meta } = await apiWithMeta<{ duels: DuelDto[] }>(
        `/api/duels?${buildQuery(params, cursor)}`,
      );
      setDuels((current) => [...current, ...data.duels]);
      setCursor((meta.nextCursor as string | null | undefined) ?? null);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? errorMessage(caught.code, caught.message) : errorMessage(undefined),
      );
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, params, errorMessage]);

  useEffect(() => {
    const element = sentinel.current;
    if (!element || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '400px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  if (duels.length === 0) {
    return (
      <EmptyState
        icon={<Swords className="size-10" />}
        title={empty?.title ?? t.home.empty}
        hint={empty?.hint ?? t.home.emptyHint}
        action={
          empty?.actionHref ? (
            <Link href={empty.actionHref}>
              <Button>{empty.actionLabel}</Button>
            </Link>
          ) : null
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {duels.map((duel, index) => (
          <DuelCard
            key={duel.id}
            duel={duel}
            categoryName={categoryNames[duel.category.slug] ?? duel.category.slug}
            priority={index < 2}
          />
        ))}
      </div>

      {error ? (
        <ErrorState
          title={error}
          action={
            <Button variant="secondary" onClick={() => void loadMore()}>
              {t.common.retry}
            </Button>
          }
        />
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <DuelCardSkeleton />
          <DuelCardSkeleton />
        </div>
      ) : null}

      <div ref={sentinel} aria-hidden className="h-px" />

      {cursor && !loading && !error ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => void loadMore()}>
            {t.common.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
