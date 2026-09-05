import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MyDuelsList } from '@/components/duel/my-duels-list';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { currentUser } from '@/server/auth/guards';
import { listAuthoredDuels } from '@/server/duels/service';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : 'uz');
  return { title: t.myDuels.title, robots: { index: false, follow: false } };
}

export default async function MyDuelsPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const t = getDictionary(locale);

  const user = await currentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/my`)}`);

  const { items } = await listAuthoredDuels(user.id, { includeHidden: true, limit: 50 });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-fg text-2xl font-black tracking-tight">{t.myDuels.title}</h1>
      <MyDuelsList initialDuels={items} />
    </div>
  );
}
