'use client';

import { useCallback, useState } from 'react';
import type { DuelDto } from '@/server/duels/dto';
import type { VoteResult } from '@/server/votes/service';
import { ApiClientError, apiPost, trackEvent } from '@/lib/client/api';
import { useI18n } from '@/components/providers/i18n-provider';
import { useToast } from '@/components/ui/toast';

export type VoteState = {
  votedOptionId: string | null;
  counts: Record<string, number>;
  percentages: Record<string, number>;
  totalVotes: number;
  inMajority: boolean;
  isTie: boolean;
  pending: string | null;
  /** True once this browser session cast the vote (drives the share prompt). */
  justVoted: boolean;
};

function initialState(duel: DuelDto): VoteState {
  const counts: Record<string, number> = {};
  const percentages: Record<string, number> = {};
  for (const option of duel.options) {
    counts[option.id] = option.voteCount;
    percentages[option.id] = option.percentage;
  }

  const best = Math.max(...duel.options.map((option) => option.voteCount));
  const leaders = duel.options.filter((option) => option.voteCount === best);

  return {
    votedOptionId: duel.votedOptionId,
    counts,
    percentages,
    totalVotes: duel.voteCount,
    isTie: leaders.length > 1 && duel.voteCount > 0,
    inMajority: leaders.length === 1 && leaders[0]?.id === duel.votedOptionId,
    pending: null,
    justVoted: false,
  };
}

/**
 * Voting state for one duel.
 *
 * The optimistic update is intentionally limited to "which side did I pick" —
 * the percentages always come from the server response, because a duel's real
 * split is the whole point of the product and must never be guessed.
 */
export function useDuelVote(duel: DuelDto, options: { onVoted?: (result: VoteResult) => void } = {}) {
  const { locale, errorMessage } = useI18n();
  const { show } = useToast();
  const [state, setState] = useState<VoteState>(() => initialState(duel));

  const vote = useCallback(
    async (optionId: string) => {
      if (state.votedOptionId || state.pending) return;
      setState((current) => ({ ...current, pending: optionId }));

      try {
        const { result } = await apiPost<{ result: VoteResult }>(
          `/api/duels/${duel.id}/vote`,
          { optionId },
        );

        setState({
          votedOptionId: result.votedOptionId,
          counts: Object.fromEntries(result.options.map((item) => [item.id, item.voteCount])),
          percentages: Object.fromEntries(result.options.map((item) => [item.id, item.percentage])),
          totalVotes: result.totalVotes,
          inMajority: result.inMajority,
          isTie: result.isTie,
          pending: null,
          justVoted: true,
        });

        trackEvent('vote', { duelId: duel.id, locale, props: { optionId } });
        options.onVoted?.(result);
      } catch (error) {
        setState((current) => ({ ...current, pending: null }));

        if (error instanceof ApiClientError && error.code === 'ALREADY_VOTED') {
          // Another tab already voted: reveal results instead of an error.
          setState((current) => ({ ...current, votedOptionId: optionId }));
        }
        show(
          error instanceof ApiClientError ? errorMessage(error.code, error.message) : errorMessage(undefined),
          'error',
        );
      }
    },
    [duel.id, state.votedOptionId, state.pending, locale, options, show, errorMessage],
  );

  return { state, vote, revealed: state.votedOptionId !== null };
}
