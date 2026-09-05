'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useI18n } from '@/components/providers/i18n-provider';
import { trackEvent } from '@/lib/client/api';

/**
 * Debounced search that drives the URL rather than local state, so a result
 * page is shareable and the server renders the first page of matches.
 */
export function SearchBar({
  initialValue = '',
  category,
  basePath,
}: {
  initialValue?: string;
  category?: string;
  basePath: string;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [value, setValue] = useState(initialValue);
  const submitted = useRef(initialValue);

  useEffect(() => {
    if (value === submitted.current) return;

    const timer = setTimeout(() => {
      submitted.current = value;
      const search = new URLSearchParams();
      if (value.trim()) search.set('q', value.trim());
      if (category) search.set('category', category);

      const query = search.toString();
      router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false });
      if (value.trim().length > 2) trackEvent('search', { locale, props: { q: value.trim() } });
    }, 350);

    return () => clearTimeout(timer);
  }, [value, category, basePath, router, locale]);

  return (
    <div className="relative">
      <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t.explore.searchPlaceholder}
        aria-label={t.common.search}
        maxLength={80}
        className="border-border bg-surface text-fg placeholder:text-fg-subtle focus:border-ring focus:ring-ring/25 w-full rounded-xl border py-2.5 pr-10 pl-10 outline-none focus:ring-2"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue('')}
          aria-label={t.common.close}
          className="text-fg-subtle hover:text-fg absolute top-1/2 right-3 -translate-y-1/2"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
