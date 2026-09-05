'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { DuelDto } from '@/server/duels/dto';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TimeAgo } from '@/components/ui/time-ago';
import { useI18n } from '@/components/providers/i18n-provider';
import {cn, formatCount } from '@/lib/utils';
import { DuelActions } from './duel-actions';
import { DuelSides } from './duel-sides';
import { ShareSheet } from './share-sheet';
import { useDuelVote } from './use-duel-vote';

/**
 * The unit of the feed: category, question, two sides, result, actions.
 *
 * Voting happens in place — a visitor never has to open the duel to take part,
 * which is what keeps the "discover -> vote" step of the loop one tap long.
 */
export function DuelCard({
  duel,
  categoryName,
  priority,
}: {
  duel: DuelDto;
  categoryName: string;
  priority?: boolean;
}) {
  const { locale, t, tag, fill } = useI18n();
  const { state, vote, revealed } = useDuelVote(duel);
  const [shareOpen, setShareOpen] = useState(false);

  const href = `/${locale}/d/${duel.slug}`;
  // Always share the canonical origin, never the window's. A visitor on a
  // preview deployment must not hand their friends a link to that deployment.
  const url = `${(process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')}${href}`;
  const chosen = duel.options.find((option) => option.id === state.votedOptionId);

  return (
    <article
      data-testid="duel-card"
      className="bg-surface border-border shadow-card animate-rise overflow-hidden rounded-2xl border"
    >
      <header className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Link href={`/${locale}/explore?category=${duel.category.slug}`}>
          <Badge className="hover:bg-surface-hover transition-colors">
            <span aria-hidden>{duel.category.emoji}</span>
            {categoryName}
          </Badge>
        </Link>

        {duel.publishedAt ? (
          <TimeAgo date={duel.publishedAt} className="text-fg-subtle ml-auto text-xs" />
        ) : null}
      </header>

      <h3 className="px-4 pb-3">
        <Link
          href={href}
          className="text-fg hover:text-accent line-clamp-2 text-base font-bold tracking-tight transition-colors"
        >
          {duel.title}
        </Link>
      </h3>

      <DuelSides duel={duel} state={state} onVote={vote} priority={priority} />

      {revealed ? (
        <div className="border-border flex items-center gap-2 border-t px-4 py-2.5">
          <span className="text-fg-muted text-xs font-semibold">
            {formatCount(state.totalVotes, tag)} {t.duel.votes}
          </span>
          {state.justVoted ? (
            <>
              <span
                className={cn(
                  'text-xs font-bold',
                  state.isTie ? 'text-warning' : state.inMajority ? 'text-success' : 'text-side-b',
                )}
              >
                {state.isTie ? t.duel.tie : state.inMajority ? t.duel.majority : t.duel.minority}
              </span>
              <Button size="sm" className="ml-auto" onClick={() => setShareOpen(true)}>
                <Sparkles className="size-3.5" />
                {t.common.share}
              </Button>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-fg-subtle border-border border-t px-4 py-2.5 text-xs font-semibold">
          {t.duel.tapToVote} · {formatCount(duel.voteCount, tag)} {t.duel.votes}
        </p>
      )}

      <div className="border-border border-t px-2 py-1">
        <DuelActions
          duel={duel}
          onShare={() => setShareOpen(true)}
          commentHref={`${href}#comments`}
        />
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
