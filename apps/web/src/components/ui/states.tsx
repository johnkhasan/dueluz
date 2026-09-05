import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-surface/60 flex flex-col items-center justify-center',
        'rounded-2xl border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? <div className="text-fg-subtle mb-3">{icon}</div> : null}
      <p className="text-fg text-base font-semibold">{title}</p>
      {hint ? <p className="text-fg-muted mt-1 max-w-sm text-sm">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="border-danger/30 bg-danger/5 rounded-2xl border px-6 py-10 text-center"
    >
      <p className="text-danger text-base font-semibold">{title}</p>
      {hint ? <p className="text-fg-muted mt-1 text-sm">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden />;
}

/** Matches the DuelCard footprint so the feed does not shift when it loads. */
export function DuelCardSkeleton() {
  return (
    <div className="bg-surface border-border shadow-card overflow-hidden rounded-2xl border">
      <div className="flex items-center gap-2 p-4">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="px-4">
        <Skeleton className="h-5 w-3/4" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-px">
        <Skeleton className="h-32 rounded-none" />
        <Skeleton className="h-32 rounded-none" />
      </div>
      <div className="flex gap-4 p-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <DuelCardSkeleton key={index} />
      ))}
    </div>
  );
}
