import Link from 'next/link';
import { ActionButton } from '@/components/admin/action-button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { formatCount, formatRelativeTime } from '@/lib/utils';
import { listDuelsAdmin } from '@/server/admin/service';

export const dynamic = 'force-dynamic';

const STATUSES = ['PUBLISHED', 'HIDDEN', 'DELETED'] as const;

export default async function AdminDuels({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const t = getDictionary(locale);

  const { status: rawStatus, q } = await searchParams;
  const status = STATUSES.includes(rawStatus as (typeof STATUSES)[number])
    ? (rawStatus as (typeof STATUSES)[number])
    : undefined;

  const { items } = await listDuelsAdmin({ status, q, limit: 50 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${locale}/admin/duels`}
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
            href={`/${locale}/admin/duels?status=${value}`}
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
          {items.map((duel) => (
            <li
              key={duel.id}
              className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-xl border p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      duel.status === 'PUBLISHED'
                        ? 'success'
                        : duel.status === 'HIDDEN'
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {duel.status}
                  </Badge>
                  <span aria-hidden>{duel.category.emoji}</span>
                  {duel._count.reports > 0 ? (
                    <Badge tone="danger">{duel._count.reports} ⚑</Badge>
                  ) : null}
                  <span className="text-fg-subtle text-xs">
                    {formatRelativeTime(duel.createdAt, locale)}
                  </span>
                </div>

                <Link
                  href={`/${locale}/d/${duel.slug}`}
                  className="text-fg hover:text-accent mt-1 block truncate font-semibold transition-colors"
                >
                  {duel.title}
                </Link>
                <p className="text-fg-subtle truncate text-xs">
                  {duel.options.map((option) => option.name).join('  vs  ')}
                  {duel.author ? ` · @${duel.author.username}` : ''} ·{' '}
                  {formatCount(duel.voteCount, locale)} {t.duel.votes}
                </p>
              </div>

              <div className="flex gap-2">
                {duel.status === 'PUBLISHED' ? (
                  <ActionButton endpoint={`/api/admin/duels/${duel.id}`} body={{ action: 'HIDE' }}>
                    {t.admin.hide}
                  </ActionButton>
                ) : (
                  <ActionButton endpoint={`/api/admin/duels/${duel.id}`} body={{ action: 'RESTORE' }}>
                    {t.admin.restore}
                  </ActionButton>
                )}
                {duel.status !== 'DELETED' ? (
                  <ActionButton
                    endpoint={`/api/admin/duels/${duel.id}`}
                    body={{ action: 'DELETE' }}
                    confirm={t.admin.confirmDelete}
                    variant="danger"
                  >
                    {t.common.delete}
                  </ActionButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
