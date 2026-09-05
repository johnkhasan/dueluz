import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'a' | 'b' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'bg-surface-muted text-fg-muted',
    a: 'bg-side-a-soft text-side-a-strong',
    b: 'bg-side-b-soft text-side-b-strong',
    success: 'bg-success/12 text-success',
    warning: 'bg-warning/12 text-warning',
    danger: 'bg-danger/12 text-danger',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
