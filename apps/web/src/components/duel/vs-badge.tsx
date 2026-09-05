import { cn } from '@/lib/utils';

/** The mark that sits between the two sides. */
export function VsBadge({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'size-8 text-[10px] border-2',
    md: 'size-11 text-xs border-[3px]',
    lg: 'size-14 text-sm border-4',
  } as const;

  return (
    <span
      aria-hidden
      className={cn(
        'brand-gradient border-bg pointer-events-none absolute top-1/2 left-1/2 z-10',
        '-translate-x-1/2 -translate-y-1/2 rounded-full',
        'flex items-center justify-center font-black tracking-wider text-white shadow-lg',
        sizes[size],
        className,
      )}
    >
      VS
    </span>
  );
}
