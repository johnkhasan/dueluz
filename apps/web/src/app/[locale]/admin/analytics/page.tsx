import Link from 'next/link';
import { BarChart } from '@/components/admin/bar-chart';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary, interpolate } from '@/lib/i18n/dictionary';
import { formatCount } from '@/lib/utils';
import { analyticsOverview } from '@/server/admin/service';

export const dynamic = 'force-dynamic';

export default async function AdminAnalytics({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const t = getDictionary(locale);
  const DAYS = 30;
  const data = await analyticsOverview(DAYS);
  const window = interpolate(t.admin.lastDays, { days: DAYS });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <BarChart data={data.votes} label={`${t.admin.totalVotes} · ${window}`} />
        <BarChart data={data.duelViews} label={`${t.admin.duelViews} · ${window}`} />
        <BarChart data={data.duelsCreated} label={`${t.admin.totalDuels} · ${window}`} />
        <BarChart data={data.shares} label={`${t.admin.sharesChart} · ${window}`} />
        <BarChart data={data.registrations} label={`${t.admin.newUsers} · ${window}`} />
      </div>

      <section className="border-border bg-surface rounded-xl border">
        <h2 className="text-fg border-border border-b px-4 py-3 text-sm font-bold">
          {t.admin.topDuels}
        </h2>
        <ul className="divide-border divide-y">
          {data.topDuels.map((duel) => (
            <li key={duel.id} className="flex items-center gap-3 px-4 py-2.5">
              <Link
                href={`/${locale}/d/${duel.slug}`}
                className="text-fg hover:text-accent min-w-0 flex-1 truncate text-sm font-semibold transition-colors"
              >
                {duel.title}
              </Link>
              <span className="text-fg-muted shrink-0 text-xs font-semibold tabular-nums">
                {formatCount(duel.voteCount, locale)} {t.duel.votes} ·{' '}
                {formatCount(duel.viewCount, locale)} {t.duel.views}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
