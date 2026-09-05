'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { COOKIES } from '@/lib/cookies';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeValue = { theme: ThemePreference; setTheme: (theme: ThemePreference) => void };

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * Theme preference lives in a plain cookie so the server can stamp
 * `data-theme` on <html> during SSR — that is what prevents the flash of the
 * wrong theme on first paint. "system" writes no attribute and lets the
 * `prefers-color-scheme` rules in globals.css decide.
 */
export function ThemeProvider({
  initial,
  children,
}: {
  initial: ThemePreference;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemePreference>(initial);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    const root = document.documentElement;
    if (next === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', next);

    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${COOKIES.theme}=${next}; path=/; max-age=${oneYear}; samesite=lax`;
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
