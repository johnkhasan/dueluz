import { cn, formatCount } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  locale = 'en',
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'neutral' | 'accent' | 'warning';
  locale?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-surface rounded-xl border p-4',
        tone === 'accent' && 'border-accent/30 bg-accent/5',
        tone === 'warning' && value > 0 && 'border-warning/40 bg-warning/5',
      )}
    >
      <p className="text-fg-subtle text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className="text-fg mt-1.5 text-2xl font-black tabular-nums">
        {formatCount(value, locale)}
      </p>
      {hint ? <p className="text-fg-muted mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}
