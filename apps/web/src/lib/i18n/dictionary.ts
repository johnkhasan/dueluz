import en from '@/messages/en.json';
import ru from '@/messages/ru.json';
import uz from '@/messages/uz.json';
import type { Locale } from './config';

/** The Uzbek file is the source of truth for the dictionary shape. */
export type Dictionary = typeof uz;

const dictionaries: Record<Locale, Dictionary> = {
  uz,
  ru: ru as Dictionary,
  en: en as Dictionary,
};

/**
 * Server-side dictionary access. Only the active dictionary is passed down to
 * client components, so the other two never reach the browser bundle.
 */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Fills `{name}` placeholders. Missing values are left untouched. */
export function interpolate(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
