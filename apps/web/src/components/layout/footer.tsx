import Link from 'next/link';
import type { Dictionary } from '@/lib/i18n/dictionary';
import type { Locale } from '@/lib/i18n/config';
import { Logo } from './logo';

export function Footer({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <footer className="border-border mt-16 border-t pb-24 sm:pb-10">
      <div className="text-fg-muted mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Logo />
          <p className="text-fg-subtle text-xs">{t.common.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href={`/${locale}`} className="hover:text-fg transition-colors">
            {t.nav.home}
          </Link>
          <Link href={`/${locale}/explore`} className="hover:text-fg transition-colors">
            {t.nav.explore}
          </Link>
          <Link href={`/${locale}/create`} className="hover:text-fg transition-colors">
            {t.nav.create}
          </Link>
        </nav>
        <p className="text-fg-subtle text-xs">
          &copy; {new Date().getFullYear()} Duel.uz
        </p>
      </div>
    </footer>
  );
}
