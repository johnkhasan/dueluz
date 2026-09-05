'use client';

import Link from 'next/link';
import { Clock, Flame, TrendingUp } from 'lucide-react';
import { useI18n } from '@/components/providers/i18n-provider';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'trending', Icon: Flame },
  { key: 'new', Icon: Clock },
  { key: 'popular', Icon: TrendingUp },
] as const;

export function FeedTabs({ active }: { active: 'trending' | 'new' | 'popular' }) {
  const { locale, t } = useI18n();
  const labels = { trending: t.home.trending, new: t.home.new, popular: t.home.popular };

  return (
    <div
      role="tablist"
      aria-label={t.home.trending}
      className="bg-surface-muted inline-flex w-full gap-1 rounded-xl p-1 sm:w-auto"
    >
      {TABS.map(({ key, Icon }) => (
        <Link
          key={key}
          href={key === 'trending' ? `/${locale}` : `/${locale}?feed=${key}`}
          role="tab"
          aria-selected={active === key}
          scroll={false}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2',
            'text-sm font-semibold transition-all sm:flex-none',
            active === key
              ? 'bg-surface text-fg shadow-sm'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          <Icon className="size-4" />
          {labels[key]}
        </Link>
      ))}
    </div>
  );
}
