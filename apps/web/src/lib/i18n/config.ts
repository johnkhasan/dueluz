export const locales = ['uz', 'ru', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'uz';

/** Native language names, used by the language switcher. */
export const localeNames: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};

export const localeFlags: Record<Locale, string> = {
  uz: '🇺🇿',
  ru: '🇷🇺',
  en: '🇬🇧',
};

/** BCP-47 tags for Intl formatting and hreflang. */
export const localeTags: Record<Locale, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Picks the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { tag: tag.trim().toLowerCase(), quality: q ? Number(q.split('=')[1]) || 0 : 1 };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const base = tag.split('-')[0];
    if (isLocale(base)) return base;
    // Uzbekistan visitors often send uz-Latn / uz-Cyrl
    if (base === 'uz') return 'uz';
  }
  return defaultLocale;
}

/** Replaces the locale segment of a pathname: /uz/d/x -> /ru/d/x */
export function localisePath(pathname: string, locale: Locale): string {
  const segments = pathname.split('/');
  if (isLocale(segments[1])) {
    segments[1] = locale;
    return segments.join('/');
  }
  return `/${locale}${pathname === '/' ? '' : pathname}`;
}
