'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { DuelDto } from '@/server/duels/dto';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TimeAgo } from '@/components/ui/time-ago';
import { useI18n } from '@/components/providers/i18n-provider';
import { trackEvent } from '@/lib/client/api';
import {cn, formatCount } from '@/lib/utils';
import { DuelActions } from './duel-actions';
import { DuelSides } from './duel-sides';
import { ShareSheet } from './share-sheet';
import { useDuelVote } from './use-duel-vote';

/**
 * The duel page's interactive core.
 *
 * After a vote it does the one thing the growth loop depends on: tell the voter
 * whether they are with the crowd, then immediately offer the share action
 * while that reaction is fresh.
 */
export function DuelDetail({
  duel,
  categoryName,
  url,
}: {
  duel: DuelDto;
  categoryName: string;
  url: string;
}) {
  const { locale, t, tag, fill } = useI18n();
  const { state, vote, revealed } = useDuelVote(duel);
  const [shareOpen, setShareOpen] = useState(false);
  const viewTracked = useRef(false);

  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    trackEvent('duel_view', { duelId: duel.id, locale });
  }, [duel.id, locale]);

  // Nudge the share sheet open right after voting - the moment of highest
  // intent in the entire loop.
  useEffect(() => {
    if (!state.justVoted) return;
    const timer = setTimeout(() => setShareOpen(true), 900);
    return () => clearTimeout(timer);
  }, [state.justVoted]);

  const chosen = duel.options.find((option) => option.id === state.votedOptionId);

  return (
    <article data-testid="duel-detail" className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/${locale}/explore?category=${duel.category.slug}`}>
            <Badge className="hover:bg-surface-hover transition-colors">
              <span aria-hidden>{duel.category.emoji}</span>
              {categoryName}
            </Badge>
          </Link>
          <span className="text-fg-subtle text-xs">
            {duel.publishedAt ? <TimeAgo date={duel.publishedAt} /> : null}
            {duel.viewCount > 0 ? ` · ${formatCount(duel.viewCount, tag)} ${t.duel.views}` : null}
          </span>
        </div>

        <h1 className="text-fg text-2xl font-black tracking-tight text-balance sm:text-4xl">
          {duel.title}
        </h1>

        {duel.description ? (
          <p className="text-fg-muted text-base text-pretty">{duel.description}</p>
        ) : null}

        {duel.author ? (
          <Link
            href={`/${locale}/u/${duel.author.username}`}
            className="text-fg-muted hover:text-fg inline-flex items-center gap-2 text-sm transition-colors"
          >
            <Avatar name={duel.author.displayName} src={duel.author.avatarUrl} size="sm" />
            <span>
              {t.duel.by} <span className="text-fg font-semibold">{duel.author.displayName}</span>
            </span>
          </Link>
        ) : null}
      </header>

      <div className="border-border shadow-card overflow-hidden rounded-2xl border">
        <DuelSides duel={duel} state={state} onVote={vote} variant="page" priority />

        <div className="bg-surface p-4">
          {revealed ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-fg-muted text-sm font-semibold">
                  {t.duel.totalVotes}:{' '}
                  <span className="text-fg">{formatCount(state.totalVotes, tag)}</span>
                </p>
                <p
                  className={cn(
                    'text-sm font-bold',
                    state.isTie ? 'text-warning' : state.inMajority ? 'text-success' : 'text-side-b',
                  )}
                >
                  {state.votedOptionId
                    ? state.isTie
                      ? t.duel.tie
                      : state.inMajority
                        ? t.duel.majority
                        : t.duel.minority
                    : null}
                </p>
              </div>

              <ResultBars duel={duel} percentages={state.percentages} counts={state.counts} />

              <Button fullWidth size="lg" onClick={() => setShareOpen(true)}>
                <Sparkles className="size-4" />
                {chosen ? fill(t.duel.sharePrompt, { option: chosen.name }) : t.duel.shareTitle}
              </Button>
            </div>
          ) : (
            <p className="text-fg-muted py-1 text-center text-sm font-semibold">
              {t.duel.tapToVote} · {formatCount(duel.voteCount, tag)} {t.duel.votes}
            </p>
          )}
        </div>

        <div className="bg-surface border-border border-t px-2 py-1">
          <DuelActions duel={duel} onShare={() => setShareOpen(true)} commentHref="#comments" />
        </div>
      </div>

      {shareOpen ? (
        <ShareSheet
          open
          onClose={() => setShareOpen(false)}
          duelId={duel.id}
          url={url}
          optionA={duel.options[0]?.name ?? ''}
          optionB={duel.options[1]?.name ?? ''}
          prompt={chosen ? fill(t.duel.sharePrompt, { option: chosen.name }) : undefined}
        />
      ) : null}
    </article>
  );
}

function ResultBars({
  duel,
  percentages,
  counts,
}: {
  duel: DuelDto;
  percentages: Record<string, number>;
  counts: Record<string, number>;
}) {
  const { tag, t } = useI18n();

  return (
    <ul className="space-y-2">
      {duel.options.map((option, index) => {
        const percentage = percentages[option.id] ?? 0;
        const side = index === 0 ? 'a' : 'b';
        return (
          <li key={option.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-fg truncate font-semibold">{option.name}</span>
              <span className="text-fg-muted shrink-0 tabular-nums">
                {percentage}% · {formatCount(counts[option.id] ?? 0, tag)} {t.duel.votes}
              </span>
            </div>
            <div className="bg-surface-muted h-2.5 overflow-hidden rounded-full">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-700 ease-out',
                  side === 'a' ? 'bg-side-a' : 'bg-side-b',
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
