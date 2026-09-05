'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { useI18n } from '@/components/providers/i18n-provider';
import { COOKIES } from '@/lib/cookies';
import { localeNames, localisePath, locales, type Locale } from '@/lib/i18n/config';

/**
 * Switching language rewrites the locale segment of the current URL, so the
 * user stays on the same duel and the new URL is the canonical one for that
 * language.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();

  function change(next: Locale) {
    document.cookie = `${COOKIES.locale}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push(localisePath(pathname, next));
    router.refresh();
  }

  return (
    <label className={className}>
      <span className="sr-only">{t.common.language}</span>
      <span className="border-border bg-surface hover:bg-surface-muted relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors">
        <Globe className="text-fg-subtle size-4" />
        <span className="uppercase">{locale}</span>
        <select
          value={locale}
          onChange={(event) => change(event.target.value as Locale)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={t.common.language}
        >
          {locales.map((code) => (
            <option key={code} value={code}>
              {localeNames[code]}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
