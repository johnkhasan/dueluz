'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { interpolate, type Dictionary } from '@/lib/i18n/dictionary';
import { localeTags, type Locale } from '@/lib/i18n/config';

type I18nValue = {
  locale: Locale;
  /** BCP-47 tag for Intl formatters. */
  tag: string;
  t: Dictionary;
  /** Fills `{name}` placeholders in a dictionary string. */
  fill: (template: string, values?: Record<string, string | number>) => string;
  /** Localised message for an API error code, with a safe fallback. */
  errorMessage: (code: string | undefined, fallback?: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(() => {
    const errors = dictionary.errors as Record<string, string | undefined>;
    return {
      locale,
      tag: localeTags[locale],
      t: dictionary,
      fill: interpolate,
      errorMessage: (code, fallback) =>
        (code ? errors[code] : undefined) ?? fallback ?? dictionary.common.somethingWrong,
    };
  }, [locale, dictionary]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}
