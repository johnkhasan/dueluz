import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Ban, Heart, Swords, ThumbsUp } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { DuelFeed } from '@/components/duel/duel-feed';
import { AppError } from '@/lib/errors';
import { isLocale, localeTags, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { formatCount, formatDate } from '@/lib/utils';
import { getPublicProfile } from '@/server/auth/service';
import { currentUser } from '@/server/auth/guards';
import { listCategories } from '@/server/categories/service';
import { getViewer } from '@/server/context';
import { listDuels } from '@/server/duels/service';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ locale: string; username: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, username } = await params;
  const t = getDictionary(isLocale(locale) ? locale : 'uz');

  try {
    const { user } = await getPublicProfile(username);
    return {
      title: `${user.displayName} (@${user.username})`,
      description: user.bio ?? t.seo.homeDescription,
      alternates: { canonical: `/${locale}/u/${user.username}` },
      openGraph: { type: 'profile', locale: localeTags[isLocale(locale) ? locale : 'uz'] },
    };
  } catch {
    return { title: t.profile.notFound, robots: { index: false, follow: false } };
  }
}

export default async function ProfilePage({ params }: PageProps) {
  const { locale: rawLocale, username } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const t = getDictionary(locale);

  let profile;
  try {
    profile = await getPublicProfile(username);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }

  const { user, stats } = profile;

  if (user.status === 'BANNED') {
    return (
      <EmptyState icon={<Ban className="size-10" />} title={t.profile.banned} />
    );
  }

  const [viewer, me, categories] = await Promise.all([
    getViewer(),
    currentUser(),
    listCategories(locale),
  ]);

  const { items, nextCursor } = await listDuels(
    { feed: 'new', author: user.username, limit: 12 },
    { userId: viewer.user?.id, anonId: viewer.anonId },
  );

  const categoryNames = Object.fromEntries(categories.map((item) => [item.slug, item.name]));
  const isSelf = me?.id === user.id;

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={user.displayName} src={user.avatarUrl} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-fg text-xl font-black tracking-tight">{user.displayName}</h1>
              {user.role !== 'USER' ? <Badge tone="a">{user.role}</Badge> : null}
            </div>
            <p className="text-fg-subtle text-sm">@{user.username}</p>
            {user.bio ? <p className="text-fg-muted mt-2 text-sm">{user.bio}</p> : null}
            <p className="text-fg-subtle mt-1 text-xs">
              {t.profile.joined}: {formatDate(user.createdAt, locale)}
            </p>
          </div>

          {isSelf ? (
            <Link href={`/${locale}/settings`}>
              <Button variant="secondary">{t.profile.editProfile}</Button>
            </Link>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Swords className="size-4" />} label={t.profile.duels} value={stats.duels} locale={locale} />
        <Stat icon={<ThumbsUp className="size-4" />} label={t.profile.votesCast} value={stats.votes} locale={locale} />
        <Stat icon={<Heart className="size-4" />} label={t.profile.likesReceived} value={stats.likesReceived} locale={locale} />
      </div>

      <DuelFeed
        initialDuels={items}
        initialCursor={nextCursor}
        params={{ feed: 'new', author: user.username }}
        categoryNames={categoryNames}
        empty={{
          title: isSelf ? t.profile.noDuelsOwn : t.profile.noDuels,
          hint: isSelf ? t.myDuels.emptyHint : undefined,
          actionHref: isSelf ? `/${locale}/create` : undefined,
          actionLabel: t.profile.createFirst,
        }}
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  locale,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  locale: string;
}) {
  return (
    <div className="border-border bg-surface rounded-xl border p-3 text-center">
      <div className="text-fg-subtle flex justify-center">{icon}</div>
      <p className="text-fg mt-1 text-xl font-black tabular-nums">{formatCount(value, locale)}</p>
      <p className="text-fg-subtle text-[11px] font-semibold">{label}</p>
    </div>
  );
}
