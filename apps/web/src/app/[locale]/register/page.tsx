import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AuthForm } from '@/components/forms/auth-form';
import { Card, CardBody } from '@/components/ui/card';
import { Logo } from '@/components/layout/logo';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { currentUser } from '@/server/auth/guards';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : 'uz');
  return { title: t.auth.registerTitle, robots: { index: false, follow: false } };
}

export default async function RegisterPage({ params }: PageProps) {
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
            <h1 className="text-fg text-2xl font-black tracking-tight">{t.auth.registerTitle}</h1>
            <p className="text-fg-muted text-sm">{t.auth.registerSubtitle}</p>
          </div>

          <Suspense fallback={null}>
            <AuthForm mode="register" />
          </Suspense>
        </CardBody>
      </Card>
    </div>
  );
}
