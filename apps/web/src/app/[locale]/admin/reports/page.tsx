import Link from 'next/link';
import { ActionButton } from '@/components/admin/action-button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { formatRelativeTime } from '@/lib/utils';
import { listReports } from '@/server/admin/service';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

const STATUSES = ['PENDING', 'RESOLVED', 'DISMISSED'] as const;

export default async function AdminReports({ params, searchParams }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const t = getDictionary(locale);

  const { status: rawStatus } = await searchParams;
  const status = STATUSES.includes(rawStatus as (typeof STATUSES)[number])
    ? (rawStatus as (typeof STATUSES)[number])
    : 'PENDING';

  const { items } = await listReports({ status, limit: 50 });

  const reasons: Record<string, string> = {
    SPAM: t.report.reasonSPAM,
    NSFW: t.report.reasonNSFW,
    HATE: t.report.reasonHATE,
    HARASSMENT: t.report.reasonHARASSMENT,
    COPYRIGHT: t.report.reasonCOPYRIGHT,
    MISINFORMATION: t.report.reasonMISINFORMATION,
    OTHER: t.report.reasonOTHER,
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={`/${locale}/admin/reports?status=${value}`}
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
        <ul className="space-y-3">
          {items.map((report) => (
            <li key={report.id} className="border-border bg-surface space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="danger">{reasons[report.reason] ?? report.reason}</Badge>
                <Badge>{report.targetType}</Badge>
                <span className="text-fg-subtle text-xs">
                  {formatRelativeTime(report.createdAt, locale)}
                  {report.reporter ? ` · @${report.reporter.username}` : ''}
                </span>
              </div>

              {report.details ? (
                <p className="text-fg-muted bg-surface-muted rounded-lg p-2.5 text-sm">
                  {report.details}
                </p>
              ) : null}

              {report.duel ? (
                <div className="space-y-1">
                  <Link
                    href={`/${locale}/d/${report.duel.slug}`}
                    className="text-fg hover:text-accent block font-semibold transition-colors"
                  >
                    {report.duel.title}
                  </Link>
                  <p className="text-fg-subtle text-xs">
                    {report.duel.options.map((option) => option.name).join('  vs  ')} ·{' '}
                    {report.duel.status}
                  </p>
                </div>
              ) : null}

              {report.comment ? (
                <div className="space-y-1">
                  <p className="text-fg text-sm">{report.comment.content}</p>
                  <p className="text-fg-subtle text-xs">
                    @{report.comment.user.username} · {report.comment.duel.title} ·{' '}
                    {report.comment.status}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {report.duel ? (
                  <>
                    <ActionButton
                      endpoint={`/api/admin/duels/${report.duel.id}`}
                      body={{ action: 'HIDE', note: `Report: ${report.reason}` }}
                      confirm={t.admin.confirmDelete}
                    >
                      {t.admin.hide}
                    </ActionButton>
                    <ActionButton
                      endpoint={`/api/admin/duels/${report.duel.id}`}
                      body={{ action: 'RESTORE' }}
                    >
                      {t.admin.restore}
                    </ActionButton>
                  </>
                ) : null}

                {report.comment ? (
                  <>
                    <ActionButton
                      endpoint={`/api/admin/comments/${report.comment.id}`}
                      body={{ action: 'HIDE' }}
                    >
                      {t.admin.hide}
                    </ActionButton>
                    <ActionButton
                      endpoint={`/api/admin/comments/${report.comment.id}`}
                      body={{ action: 'DELETE' }}
                      confirm={t.admin.confirmDelete}
                    >
                      {t.common.delete}
                    </ActionButton>
                  </>
                ) : null}

                {report.status === 'PENDING' ? (
                  <>
                    <ActionButton
                      endpoint={`/api/admin/reports/${report.id}`}
                      body={{ action: 'RESOLVE' }}
                      variant="primary"
                    >
                      {t.admin.resolve}
                    </ActionButton>
                    <ActionButton
                      endpoint={`/api/admin/reports/${report.id}`}
                      body={{ action: 'DISMISS' }}
                      variant="ghost"
                    >
                      {t.admin.dismiss}
                    </ActionButton>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
