import { cn } from '@/lib/utils';

export type SeriesPoint = { date: string; count: number };

/**
 * Minimal daily bar chart.
 *
 * Hand-rolled rather than pulling in a charting library: the admin panel needs
 * exactly one chart shape, and a 60-line SVG beats a 400 KB dependency.
 */
export function BarChart({
  data,
  label,
  className,
}: {
  data: SeriesPoint[];
  label: string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((point) => point.count));
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <figure className={cn('border-border bg-surface rounded-xl border p-4', className)}>
      <figcaption className="flex items-baseline justify-between">
        <span className="text-fg text-sm font-bold">{label}</span>
        <span className="text-fg-subtle text-xs font-semibold tabular-nums">{total}</span>
      </figcaption>

      <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label={`${label}: ${total}`}>
        {data.map((point) => (
          <div key={point.date} className="group relative flex-1">
            <div
              className="bg-accent/80 group-hover:bg-accent min-h-[2px] rounded-t transition-colors"
              style={{ height: `${Math.round((point.count / max) * 112)}px` }}
            />
            <span className="bg-fg text-bg pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
              {point.date.slice(5)}: {point.count}
            </span>
          </div>
        ))}
      </div>

      <div className="text-fg-subtle mt-2 flex justify-between text-[10px] font-semibold">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </figure>
  );
}
