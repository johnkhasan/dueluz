import type { Metadata } from 'next';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { CreateDuelWizard } from '@/components/forms/create-duel-wizard';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { currentUser } from '@/server/auth/guards';
import { listCategories } from '@/server/categories/service';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : 'uz');
  return {
    title: t.seo.createTitle,
    description: t.seo.createDescription,
    alternates: { canonical: `/${locale}/create` },
  };
}

export default async function CreatePage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const t = getDictionary(locale);

  const [user, categories] = await Promise.all([currentUser(), listCategories(locale)]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-fg text-2xl font-black tracking-tight">{t.create.title}</h1>
        <p className="text-fg-muted mt-1 text-sm">{t.create.subtitle}</p>
      </div>

      {user ? (
        <CreateDuelWizard categories={categories} />
      ) : (
        <EmptyState
          icon={<LogIn className="size-10" />}
          title={t.create.loginRequired}
          hint={t.auth.anonymousNote}
          action={
            <Link href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/create`)}`}>
              <Button size="lg">{t.create.loginToCreate}</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
