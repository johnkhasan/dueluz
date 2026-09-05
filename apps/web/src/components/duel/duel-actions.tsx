'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Flag, Heart, MessageCircle, Share2 } from 'lucide-react';
import type { DuelDto } from '@/server/duels/dto';
import { useI18n } from '@/components/providers/i18n-provider';
import { useSession } from '@/components/providers/session-provider';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiDelete, apiPost } from '@/lib/client/api';
import { cn, formatCount } from '@/lib/utils';
import { ReportDialog } from './report-dialog';

export function DuelActions({
  duel,
  onShare,
  commentHref,
  className,
}: {
  duel: DuelDto;
  onShare: () => void;
  /** Where the comment count links to: the duel page, or `#comments` on it. */
  commentHref: string;
  className?: string;
}) {
  const { t, tag, locale, errorMessage } = useI18n();
  const user = useSession();
  const { show } = useToast();

  const [liked, setLiked] = useState(duel.liked);
  const [likeCount, setLikeCount] = useState(duel.likeCount);
  const [pending, setPending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  async function toggleLike() {
    if (!user) {
      window.location.href = `/${locale}/login?next=${encodeURIComponent(`/${locale}/d/${duel.slug}`)}`;
      return;
    }
    if (pending) return;

    // Optimistic: a like is trivially reversible, so the instant response is
    // worth more than waiting for the round-trip.
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((count) => count + (nextLiked ? 1 : -1));
    setPending(true);

    try {
      const result = nextLiked
        ? await apiPost<{ liked: boolean; likeCount: number }>(`/api/duels/${duel.id}/like`)
        : await apiDelete<{ liked: boolean; likeCount: number }>(`/api/duels/${duel.id}/like`);
      setLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch (error) {
      setLiked(!nextLiked);
      setLikeCount((count) => count + (nextLiked ? -1 : 1));
      show(
        error instanceof ApiClientError ? errorMessage(error.code, error.message) : errorMessage(undefined),
        'error',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className={cn('text-fg-muted flex items-center gap-1', className)}>
        <ActionButton
          onClick={toggleLike}
          active={liked}
          label={t.duel.like}
          className={liked ? 'text-side-b' : undefined}
        >
          <Heart className={cn('size-4', liked && 'fill-current')} />
          {formatCount(likeCount, tag)}
        </ActionButton>

        <Link
          href={commentHref}
          aria-label={t.duel.comments}
          className="hover:bg-surface-muted hover:text-fg inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors"
        >
          <MessageCircle className="size-4" />
          {formatCount(duel.commentCount, tag)}
        </Link>

        <ActionButton onClick={onShare} label={t.common.share}>
          <Share2 className="size-4" />
          {duel.shareCount > 0 ? formatCount(duel.shareCount, tag) : null}
        </ActionButton>

        <ActionButton
          onClick={() => setReportOpen(true)}
          label={t.duel.report}
          className="ml-auto"
        >
          <Flag className="size-4" />
        </ActionButton>
      </div>

      {reportOpen ? (
        <ReportDialog open onClose={() => setReportOpen(false)} target="duel" id={duel.id} />
      ) : null}
    </>
  );
}

function ActionButton({
  children,
  onClick,
  label,
  active,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'hover:bg-surface-muted hover:text-fg inline-flex items-center gap-1.5',
        'rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors',
        className,
      )}
    >
      {children}
    </button>
  );
}
