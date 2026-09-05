import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SettingsForm } from '@/components/forms/settings-form';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { currentUser } from '@/server/auth/guards';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : 'uz');
  return { title: t.settings.title, robots: { index: false, follow: false } };
}

export default async function SettingsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : 'uz');

  const user = await currentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/settings`)}`);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-fg text-2xl font-black tracking-tight">{t.settings.title}</h1>
      <SettingsForm
        user={{
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          telegramUsername: user.telegramUsername,
        }}
      />
    </div>
  );
}
