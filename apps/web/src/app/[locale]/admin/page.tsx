import Link from 'next/link';
import { StatCard } from '@/components/admin/stat-card';
import { BarChart } from '@/components/admin/bar-chart';
import { Button } from '@/components/ui/button';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary, interpolate } from '@/lib/i18n/dictionary';
import { analyticsOverview, dashboardStats } from '@/server/admin/service';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const t = getDictionary(locale);

  const DAYS = 14;
  const [stats, analytics] = await Promise.all([dashboardStats(), analyticsOverview(DAYS)]);
  const window = interpolate(t.admin.lastDays, { days: DAYS });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Weekly Meaningful Voters"
          value={stats.weeklyMeaningfulVoters}
          hint="7 kun / 7 дней / 7 days"
          tone="accent"
          locale={locale}
        />
        <StatCard
          label={t.admin.pendingReports}
          value={stats.pendingReports}
          tone="warning"
          locale={locale}
        />
        <StatCard label={t.admin.totalVotes} value={stats.votes} hint={`+${stats.votes24h} / 24h`} locale={locale} />
        <StatCard label={t.admin.totalUsers} value={stats.users} hint={`+${stats.newUsers24h} / 24h`} locale={locale} />
        <StatCard label={t.admin.totalDuels} value={stats.duels} hint={`+${stats.duels7d} / 7d`} locale={locale} />
        <StatCard label={t.admin.totalComments} value={stats.comments} locale={locale} />
      </div>

      {stats.pendingReports > 0 ? (
        <Link href={`/${locale}/admin/reports`}>
          <Button>
            {t.admin.reports} ({stats.pendingReports})
          </Button>
        </Link>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <BarChart data={analytics.votes} label={`${t.admin.totalVotes} · ${window}`} />
        <BarChart data={analytics.duelViews} label={`${t.admin.duelViews} · ${window}`} />
        <BarChart data={analytics.duelsCreated} label={`${t.admin.totalDuels} · ${window}`} />
        <BarChart data={analytics.registrations} label={`${t.admin.newUsers} · ${window}`} />
      </div>
    </div>
  );
}
