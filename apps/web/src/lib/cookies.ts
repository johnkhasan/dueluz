export const COOKIES = {
  session: 'duel_session',
  anon: 'duel_anon',
  locale: 'duel_locale',
  theme: 'duel_theme',
} as const;

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const ANON_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year
