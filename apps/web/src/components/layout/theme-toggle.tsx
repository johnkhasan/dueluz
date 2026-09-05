'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useI18n } from '@/components/providers/i18n-provider';
import { useTheme, type ThemePreference } from '@/components/providers/theme-provider';
import { cn } from '@/lib/utils';

const OPTIONS: { value: ThemePreference; Icon: typeof Sun }[] = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
  { value: 'system', Icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const labels: Record<ThemePreference, string> = {
    light: t.common.light,
    dark: t.common.dark,
    system: t.common.system,
  };

  return (
    <div
      role="radiogroup"
      aria-label={t.common.theme}
      className="bg-surface-muted inline-flex rounded-lg p-0.5"
    >
      {OPTIONS.map(({ value, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={labels[value]}
          title={labels[value]}
          onClick={() => setTheme(value)}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            theme === value ? 'bg-surface text-fg shadow-sm' : 'text-fg-subtle hover:text-fg',
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
