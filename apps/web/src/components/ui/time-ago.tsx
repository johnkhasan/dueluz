'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/providers/i18n-provider';
import { formatDate, formatRelativeTime } from '@/lib/utils';

/**
 * Relative timestamp that is hydration-safe.
 *
 * "2 days ago" depends on the reader's clock and timezone, so computing it
 * during SSR guarantees a mismatch with the browser's first render. The server
 * (and the first client render) emit the absolute date; the relative form
 * appears after mount. The `<time datetime>` wrapper keeps the machine-readable
 * value in the markup either way.
 */
export function TimeAgo({ date, className }: { date: string | Date; className?: string }) {
  const { locale } = useI18n();
  const iso = typeof date === 'string' ? date : date.toISOString();
  // Locale-independent placeholder: identical on the server and in the first
  // client render, whatever ICU data either side happens to ship.
  const [label, setLabel] = useState<string>(() => iso.slice(0, 10));

  useEffect(() => {
    setLabel(formatRelativeTime(iso, locale));
  }, [iso, locale]);

  return (
    <time dateTime={iso} title={formatDate(iso, locale)} className={className}>
      {label}
    </time>
  );
}
