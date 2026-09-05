'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Flag, Heart, MessageCircle, Trash2 } from 'lucide-react';
import type { CommentDto } from '@/server/comments/service';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { TimeAgo } from '@/components/ui/time-ago';
import { useI18n } from '@/components/providers/i18n-provider';
import { useSession } from '@/components/providers/session-provider';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiDelete, apiPost, apiWithMeta, trackEvent } from '@/lib/client/api';
import {cn, formatCount } from '@/lib/utils';
import { ReportDialog } from './report-dialog';

const MAX_LENGTH = 1000;

export function CommentSection({
  duelId,
  initialCount,
  anchorId,
}: {
  duelId: string;
  initialCount: number;
  anchorId?: string;
}) {
  const { locale, t, tag, fill, errorMessage } = useI18n();
  const user = useSession();
  const { show } = useToast();

  const [comments, setComments] = useState<CommentDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);

  const load = useCallback(
    async (next?: string | null) => {
      setLoading(true);
      try {
        const { data, meta } = await apiWithMeta<{ comments: CommentDto[] }>(
          `/api/duels/${duelId}/comments${next ? `?cursor=${encodeURIComponent(next)}` : ''}`,
        );
        setComments((current) => (next ? [...current, ...data.comments] : data.comments));
        setCursor((meta.nextCursor as string | null | undefined) ?? null);
      } catch {
        show(errorMessage(undefined), 'error');
      } finally {
        setLoading(false);
      }
    },
    [duelId, show, errorMessage],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim() || posting) return;

    setPosting(true);
    try {
      const { comment } = await apiPost<{ comment: CommentDto }>(
        `/api/duels/${duelId}/comments`,
        { content },
      );
      setComments((current) => [comment, ...current]);
      setContent('');
      trackEvent('comment_created', { duelId, locale });
    } catch (error) {
      show(
        error instanceof ApiClientError ? errorMessage(error.code, error.message) : errorMessage(undefined),
        'error',
      );
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t.comments.deleteConfirm)) return;
    const snapshot = comments;
    setComments((current) => current.filter((comment) => comment.id !== id));

    try {
      await apiDelete(`/api/comments/${id}`);
      show(t.comments.deleted, 'success');
    } catch {
      setComments(snapshot);
      show(errorMessage(undefined), 'error');
    }
  }

  async function toggleLike(comment: CommentDto) {
    if (!user) return;
    const optimistic = !comment.liked;
    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? { ...item, liked: optimistic, likeCount: item.likeCount + (optimistic ? 1 : -1) }
          : item,
      ),
    );

    try {
      const result = await apiPost<{ liked: boolean; likeCount: number }>(
        `/api/comments/${comment.id}/like`,
      );
      setComments((current) =>
        current.map((item) =>
          item.id === comment.id ? { ...item, liked: result.liked, likeCount: result.likeCount } : item,
        ),
      );
    } catch {
      setComments((current) =>
        current.map((item) =>
          item.id === comment.id
            ? { ...item, liked: !optimistic, likeCount: item.likeCount + (optimistic ? -1 : 1) }
            : item,
        ),
      );
    }
  }

  const remaining = MAX_LENGTH - content.length;

  return (
    <section id={anchorId} className="space-y-4 scroll-mt-20">
      <h2 className="text-fg flex items-center gap-2 text-lg font-bold tracking-tight">
        <MessageCircle className="size-5" />
        {t.comments.title}
        <span className="text-fg-subtle text-sm font-semibold">
          {formatCount(Math.max(initialCount, comments.length), tag)}
        </span>
      </h2>

      {user ? (
        <form onSubmit={submit} className="space-y-2">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value.slice(0, MAX_LENGTH))}
            placeholder={t.comments.placeholder}
            rows={3}
            className="border-border bg-surface text-fg placeholder:text-fg-subtle focus:border-ring focus:ring-ring/25 w-full resize-y rounded-xl border px-3.5 py-2.5 outline-none focus:ring-2"
          />
          <div className="flex items-center justify-between gap-3">
            <span className={cn('text-xs', remaining < 50 ? 'text-warning' : 'text-fg-subtle')}>
              {fill(t.comments.charactersLeft, { count: remaining })}
            </span>
            <Button type="submit" size="sm" loading={posting} disabled={!content.trim()}>
              {t.comments.post}
            </Button>
          </div>
        </form>
      ) : (
        <Link href={`/${locale}/login`}>
          <Button variant="secondary" fullWidth>
            {t.comments.loginToComment}
          </Button>
        </Link>
      )}

      {loading && comments.length === 0 ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : comments.length === 0 ? (
        <EmptyState title={t.comments.empty} hint={t.comments.emptyHint} />
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="border-border bg-surface rounded-xl border p-3.5">
              <div className="flex items-start gap-3">
                <Link href={`/${locale}/u/${comment.author.username}`}>
                  <Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size="sm" />
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <Link
                      href={`/${locale}/u/${comment.author.username}`}
                      className="text-fg truncate text-sm font-semibold hover:underline"
                    >
                      {comment.author.displayName}
                    </Link>
                    <TimeAgo
                      date={comment.createdAt}
                      className="text-fg-subtle shrink-0 text-xs"
                    />
                  </div>

                  <p className="text-fg mt-1 text-sm whitespace-pre-wrap">{comment.content}</p>

                  <div className="text-fg-subtle mt-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void toggleLike(comment)}
                      disabled={!user}
                      aria-label={t.duel.like}
                      className={cn(
                        'hover:text-fg inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold transition-colors',
                        comment.liked && 'text-side-b',
                      )}
                    >
                      <Heart className={cn('size-3.5', comment.liked && 'fill-current')} />
                      {comment.likeCount > 0 ? comment.likeCount : null}
                    </button>

                    <button
                      type="button"
                      onClick={() => setReporting(comment.id)}
                      aria-label={t.duel.report}
                      className="hover:text-fg rounded-md px-1.5 py-1 transition-colors"
                    >
                      <Flag className="size-3.5" />
                    </button>

                    {comment.canDelete ? (
                      <button
                        type="button"
                        onClick={() => void remove(comment.id)}
                        aria-label={t.common.delete}
                        className="hover:text-danger ml-auto rounded-md px-1.5 py-1 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {cursor ? (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" loading={loading} onClick={() => void load(cursor)}>
            {t.common.loadMore}
          </Button>
        </div>
      ) : null}

      {reporting ? (
        <ReportDialog open onClose={() => setReporting(null)} target="comment" id={reporting} />
      ) : null}
    </section>
  );
}
