'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import type { DuelDto } from '@/server/duels/dto';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { TimeAgo } from '@/components/ui/time-ago';
import { useI18n } from '@/components/providers/i18n-provider';
import { useToast } from '@/components/ui/toast';
import { apiDelete } from '@/lib/client/api';
import {formatCount } from '@/lib/utils';

const TONES = {
  PUBLISHED: 'success',
  HIDDEN: 'warning',
  DRAFT: 'neutral',
  DELETED: 'danger',
} as const;

export function MyDuelsList({ initialDuels }: { initialDuels: DuelDto[] }) {
  const { locale, t, tag, errorMessage } = useI18n();
  const { show } = useToast();
  const [duels, setDuels] = useState(initialDuels);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(id: string) {
    if (!window.confirm(t.myDuels.deleteConfirm)) return;
    setDeleting(id);

    try {
      await apiDelete(`/api/duels/${id}`);
      setDuels((current) => current.filter((duel) => duel.id !== id));
    } catch {
      show(errorMessage(undefined), 'error');
    } finally {
      setDeleting(null);
    }
  }

  if (duels.length === 0) {
    return (
      <EmptyState
        title={t.myDuels.empty}
        hint={t.myDuels.emptyHint}
        action={
          <Link href={`/${locale}/create`}>
            <Button>{t.profile.createFirst}</Button>
          </Link>
        }
      />
    );
  }

  const statusLabels: Record<string, string> = {
    PUBLISHED: t.myDuels.statusPUBLISHED,
    HIDDEN: t.myDuels.statusHIDDEN,
    DRAFT: t.myDuels.statusDRAFT,
    DELETED: t.myDuels.statusDELETED,
  };

  return (
    <ul className="space-y-3">
      {duels.map((duel) => (
        <li
          key={duel.id}
          className="border-border bg-surface flex items-center gap-3 rounded-xl border p-3.5"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TONES[duel.status] ?? 'neutral'}>{statusLabels[duel.status]}</Badge>
              {duel.publishedAt ? (
                <TimeAgo date={duel.publishedAt} className="text-fg-subtle text-xs" />
              ) : null}
            </div>

            <Link
              href={`/${locale}/d/${duel.slug}`}
              className="text-fg hover:text-accent mt-1 block truncate font-semibold transition-colors"
            >
              {duel.title}
            </Link>

            <p className="text-fg-subtle mt-0.5 truncate text-xs">
              {duel.options.map((option) => option.name).join('  vs  ')}
            </p>

            <p className="text-fg-muted mt-1 text-xs font-semibold">
              {formatCount(duel.voteCount, tag)} {t.duel.votes} ·{' '}
              {formatCount(duel.commentCount, tag)} {t.duel.comments} ·{' '}
              {formatCount(duel.likeCount, tag)} {t.duel.like}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Link
              href={`/${locale}/d/${duel.slug}`}
              className="text-fg-subtle hover:bg-surface-muted hover:text-fg rounded-lg p-2 transition-colors"
              aria-label={t.create.viewDuel}
            >
              <ExternalLink className="size-4" />
            </Link>
            <button
              type="button"
              onClick={() => void remove(duel.id)}
              disabled={deleting === duel.id}
              aria-label={t.common.delete}
              className="text-fg-subtle hover:bg-danger/10 hover:text-danger rounded-lg p-2 transition-colors disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
