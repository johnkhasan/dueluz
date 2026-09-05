import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { TelegramLogin } from '@/components/forms/telegram-login';
import { Card, CardBody } from '@/components/ui/card';
import { Logo } from '@/components/layout/logo';
import { TELEGRAM_BOT_USERNAME } from '@/lib/env';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { currentUser } from '@/server/auth/guards';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : 'uz');
  return { title: t.auth.loginTitle, robots: { index: false, follow: false } };
}

export default async function LoginPage({ params }: PageProps) {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : 'uz');

  if (await currentUser()) redirect(`/${locale}`);

  return (
    <div className="mx-auto max-w-md py-6">
      <Card>
        <CardBody className="space-y-5">
          <div className="space-y-2 text-center">
            <div className="flex justify-center">
              <Logo />
            </div>
            <h1 className="text-fg text-2xl font-black tracking-tight">{t.auth.loginTitle}</h1>
            <p className="text-fg-muted text-sm">{t.auth.loginSubtitle}</p>
          </div>

          <Suspense fallback={null}>
            <TelegramLogin botUsername={TELEGRAM_BOT_USERNAME} />
          </Suspense>

          <p className="text-fg-muted border-border border-t pt-4 text-center text-sm">
            {t.auth.anonymousNote}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
