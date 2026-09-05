import { prisma } from '@dueluz/db';
import type { AnalyticsEventName } from '@/lib/validation';

export type TrackInput = {
  name: AnalyticsEventName;
  userId?: string | null;
  anonId?: string | null;
  duelId?: string | null;
  locale?: string | null;
  props?: Record<string, string | number | boolean>;
};

/**
 * Fire-and-forget product analytics.
 *
 * Events are attributed to an account id or the signed anonymous cookie id —
 * never to an IP address or any other identifier the visitor did not opt into
 * by using the site.
 */
export async function track(input: TrackInput): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name: input.name,
        userId: input.userId ?? null,
        anonId: input.userId ? null : (input.anonId ?? null),
        duelId: input.duelId ?? null,
        locale: input.locale ?? null,
        props: input.props ?? {},
      },
    });
  } catch (error) {
    // Analytics must never break a user-facing request.
    console.warn('[analytics] failed to record event', error);
  }
}

export type DailyPoint = { date: string; count: number };

/** Daily counts for one event name, used by the admin analytics charts. */
export async function dailySeries(
  name: AnalyticsEventName,
  days: number,
): Promise<DailyPoint[]> {
  const since = new Date(Date.now() - days * 86_400_000);

  const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT date_trunc('day', "created_at") AS day, count(*)::bigint AS count
    FROM "analytics_events"
    WHERE "name" = ${name} AND "created_at" >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const byDay = new Map(rows.map((row) => [row.day.toISOString().slice(0, 10), Number(row.count)]));
  const series: DailyPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
    series.push({ date, count: byDay.get(date) ?? 0 });
  }
  return series;
}

/**
 * Weekly Meaningful Voters - the product's primary success metric.
 * A meaningful voter is a distinct identity that cast at least one vote in the
 * last 7 days.
 */
export async function weeklyMeaningfulVoters(): Promise<number> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count FROM (
      SELECT DISTINCT coalesce("user_id", "anon_id") AS identity
      FROM "votes"
      WHERE "created_at" >= ${since}
    ) AS voters
  `;
  return Number(rows[0]?.count ?? 0);
}
