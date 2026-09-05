'use client';

import { Check } from 'lucide-react';
import type { DuelDto } from '@/server/duels/dto';
import { Spinner } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OptionFace } from './option-face';
import { VsBadge } from './vs-badge';
import type { VoteState } from './use-duel-vote';

type Props = {
  duel: DuelDto;
  state: VoteState;
  onVote: (optionId: string) => void;
  variant?: 'card' | 'page';
  priority?: boolean;
};

/**
 * The two sides of a duel, before and after voting.
 *
 * Before: two large targets, nothing else competing for the tap.
 * After: the same two faces, resized in proportion to the result, so the
 * outcome is legible in one glance without reading a number.
 */
export function DuelSides({ duel, state, onVote, variant = 'card', priority }: Props) {
  const [optionA, optionB] = duel.options;
  if (!optionA || !optionB) return null;

  const revealed = state.votedOptionId !== null;
  const height = variant === 'page' ? 'h-56 sm:h-72' : 'h-36 sm:h-40';

  const percentA = state.percentages[optionA.id] ?? 50;
  const percentB = 100 - percentA;

  // Keep both sides visible even at a 97/3 split.
  const widthA = revealed ? Math.min(78, Math.max(22, percentA)) : 50;

  return (
    <div className={cn('relative flex overflow-hidden', height)}>
      <VsBadge size={variant === 'page' ? 'lg' : 'md'} />

      <Side
        option={optionA}
        side="a"
        width={widthA}
        percentage={percentA}
        state={state}
        revealed={revealed}
        variant={variant}
        priority={priority}
        onVote={onVote}
      />
      <Side
        option={optionB}
        side="b"
        width={100 - widthA}
        percentage={percentB}
        state={state}
        revealed={revealed}
        variant={variant}
        priority={priority}
        onVote={onVote}
      />
    </div>
  );
}

function Side({
  option,
  side,
  width,
  percentage,
  state,
  revealed,
  variant,
  priority,
  onVote,
}: {
  option: DuelDto['options'][number];
  side: 'a' | 'b';
  width: number;
  percentage: number;
  state: VoteState;
  revealed: boolean;
  variant: 'card' | 'page';
  priority?: boolean;
  onVote: (optionId: string) => void;
}) {
  const chosen = state.votedOptionId === option.id;
  const pending = state.pending === option.id;
  const disabled = revealed || state.pending !== null;

  return (
    <button
      type="button"
      onClick={() => onVote(option.id)}
      disabled={disabled}
      aria-label={option.name}
      aria-pressed={chosen}
      data-testid="duel-side"
      data-side={side}
      style={{ width: `${width}%` }}
      className={cn(
        'group relative min-w-0 transition-[width] duration-500 ease-out',
        !disabled && 'cursor-pointer',
        side === 'a' ? 'border-r-2' : 'border-l-2',
        'border-bg',
        chosen && (side === 'a' ? 'ring-side-a ring-inset ring-3' : 'ring-side-b ring-inset ring-3'),
      )}
    >
      <OptionFace
        name={option.name}
        imageUrl={option.imageUrl}
        side={side}
        priority={priority}
        className="absolute inset-0"
        sizes={variant === 'page' ? '(max-width: 640px) 50vw, 400px' : '(max-width: 640px) 50vw, 300px'}
      />

      {!disabled ? (
        <span
          className="absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/10 group-active:bg-white/20"
          aria-hidden
        />
      ) : null}

      <span className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-0.5 p-3 text-left">
        {revealed ? (
          <span
            data-testid="duel-percentage"
            className={cn(
              'animate-pop font-black text-white drop-shadow-lg',
              variant === 'page' ? 'text-4xl sm:text-5xl' : 'text-2xl',
            )}
          >
            {percentage}%
          </span>
        ) : null}

        <span
          className={cn(
            'flex w-full items-center gap-1.5 font-bold text-white drop-shadow',
            variant === 'page' ? 'text-base sm:text-lg' : 'text-sm',
          )}
        >
          {chosen ? (
            <Check className="size-4 shrink-0" strokeWidth={3} />
          ) : null}
          <span className="line-clamp-2 min-w-0">{option.name}</span>
        </span>
      </span>

      {pending ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Spinner className="size-6 text-white" />
        </span>
      ) : null}
    </button>
  );
}
