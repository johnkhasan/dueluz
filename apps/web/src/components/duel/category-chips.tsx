'use client';

import Link from 'next/link';
import type { CategoryDto } from '@/server/categories/service';
import { useI18n } from '@/components/providers/i18n-provider';
import { cn } from '@/lib/utils';

export function CategoryChips({
  categories,
  active,
  basePath,
  extraQuery,
}: {
  categories: CategoryDto[];
  active?: string;
  basePath: string;
  extraQuery?: Record<string, string | undefined>;
}) {
  const { t } = useI18n();

  function href(slug?: string): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(extraQuery ?? {})) {
      if (value) search.set(key, value);
    }
    if (slug) search.set('category', slug);
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      <Chip href={href()} active={!active}>
        {t.explore.allCategories}
      </Chip>
      {categories.map((category) => (
        <Chip key={category.id} href={href(category.slug)} active={active === category.slug}>
          <span aria-hidden>{category.emoji}</span>
          {category.name}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2',
        'text-sm font-semibold whitespace-nowrap transition-colors',
        active
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-border bg-surface text-fg-muted hover:bg-surface-muted hover:text-fg',
      )}
    >
      {children}
    </Link>
  );
}
