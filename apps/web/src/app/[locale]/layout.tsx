import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import '../globals.css';

import { I18nProvider } from '@/components/providers/i18n-provider';
import { SessionProvider } from '@/components/providers/session-provider';
import { ThemeProvider, type ThemePreference } from '@/components/providers/theme-provider';
import { ToastProvider } from '@/components/ui/toast';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Footer } from '@/components/layout/footer';
import { TopNav } from '@/components/layout/top-nav';
import { COOKIES } from '@/lib/cookies';
import { APP_NAME, APP_URL } from '@/lib/env';
import { isLocale, locales, localeTags, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { currentUser } from '@/server/auth/guards';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f7fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a12' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);

  return {
    metadataBase: new URL(APP_URL),
    title: { default: t.seo.homeTitle, template: `%s | ${APP_NAME}` },
    description: t.seo.homeDescription,
    applicationName: APP_NAME,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(locales.map((code) => [localeTags[code], `/${code}`])),
    },
    openGraph: {
      type: 'website',
      siteName: APP_NAME,
      locale: localeTags[locale],
      title: t.seo.homeTitle,
      description: t.seo.homeDescription,
      url: `/${locale}`,
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const typedLocale: Locale = locale;
  const dictionary = getDictionary(typedLocale);
  const [user, store] = await Promise.all([currentUser(), cookies()]);

  // Stamped during SSR so the correct theme paints on the very first frame.
  const themeCookie = store.get(COOKIES.theme)?.value;
  const theme: ThemePreference =
    themeCookie === 'dark' || themeCookie === 'light' ? themeCookie : 'system';

  return (
    <html
      lang={typedLocale}
      {...(theme === 'system' ? {} : { 'data-theme': theme })}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <I18nProvider locale={typedLocale} dictionary={dictionary}>
          <ThemeProvider initial={theme}>
            <SessionProvider
              user={
                user
                  ? {
                      id: user.id,
                      username: user.username,
                      displayName: user.displayName,
                      avatarUrl: user.avatarUrl,
                      role: user.role,
                    }
                  : null
              }
            >
              <ToastProvider>
                <a
                  href="#main"
                  className="bg-surface text-fg sr-only rounded-lg px-4 py-2 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
                >
                  {dictionary.nav.home}
                </a>

                <TopNav />
                <main id="main" className="mx-auto max-w-6xl px-4 pt-5 pb-8">
                  {children}
                </main>
                <Footer locale={typedLocale} t={dictionary} />
                <BottomNav />
              </ToastProvider>
            </SessionProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
