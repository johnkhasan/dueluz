import Link from 'next/link';
import { ActionButton } from '@/components/admin/action-button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { formatRelativeTime } from '@/lib/utils';
import { listCommentsAdmin } from '@/server/admin/service';

export const dynamic = 'force-dynamic';

const STATUSES = ['VISIBLE', 'HIDDEN'] as const;

export default async function AdminComments({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const t = getDictionary(locale);

  const { status: rawStatus } = await searchParams;
  const status = STATUSES.includes(rawStatus as (typeof STATUSES)[number])
    ? (rawStatus as (typeof STATUSES)[number])
    : undefined;

  const { items } = await listCommentsAdmin({ status, limit: 50 });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Link
          href={`/${locale}/admin/comments`}
          className={
            !status
              ? 'bg-accent text-accent-fg rounded-lg px-3 py-1.5 text-sm font-semibold'
              : 'bg-surface border-border text-fg-muted hover:text-fg rounded-lg border px-3 py-1.5 text-sm font-semibold'
          }
        >
          {t.common.all}
        </Link>
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={`/${locale}/admin/comments?status=${value}`}
            className={
              value === status
                ? 'bg-accent text-accent-fg rounded-lg px-3 py-1.5 text-sm font-semibold'
                : 'bg-surface border-border text-fg-muted hover:text-fg rounded-lg border px-3 py-1.5 text-sm font-semibold'
            }
          >
            {value}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title={t.admin.noItems} />
      ) : (
        <ul className="space-y-2">
          {items.map((comment) => (
            <li key={comment.id} className="border-border bg-surface rounded-xl border p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={comment.status === 'VISIBLE' ? 'success' : 'warning'}>
                  {comment.status}
                </Badge>
                {comment._count.reports > 0 ? (
                  <Badge tone="danger">{comment._count.reports} ⚑</Badge>
                ) : null}
                <span className="text-fg-subtle text-xs">
                  @{comment.user.username} · {formatRelativeTime(comment.createdAt, locale)}
                </span>
              </div>

              <p className="text-fg mt-2 text-sm whitespace-pre-wrap">{comment.content}</p>

              <Link
                href={`/${locale}/d/${comment.duel.slug}#comments`}
                className="text-fg-subtle hover:text-fg mt-1 block truncate text-xs transition-colors"
              >
                {comment.duel.title}
              </Link>

              <div className="mt-3 flex gap-2">
                {comment.status === 'VISIBLE' ? (
                  <ActionButton
                    endpoint={`/api/admin/comments/${comment.id}`}
                    body={{ action: 'HIDE' }}
                  >
                    {t.admin.hide}
                  </ActionButton>
                ) : (
                  <ActionButton
                    endpoint={`/api/admin/comments/${comment.id}`}
                    body={{ action: 'RESTORE' }}
                  >
                    {t.admin.restore}
                  </ActionButton>
                )}
                <ActionButton
                  endpoint={`/api/admin/comments/${comment.id}`}
                  body={{ action: 'DELETE' }}
                  confirm={t.admin.confirmDelete}
                  variant="danger"
                >
                  {t.common.delete}
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
