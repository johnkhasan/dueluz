import { cn, initials } from '@/lib/utils';

/**
 * Deterministic accent per user, so an avatarless account still has a stable
 * visual identity across the app.
 */
function hueFor(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % 360;
}

const SIZES = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-16 text-lg' } as const;

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white',
    SIZES[size],
    className,
  );

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cn(classes, 'object-cover')} loading="lazy" />;
  }

  const hue = hueFor(name);
  return (
    <span
      className={classes}
      style={{ background: `linear-gradient(140deg, hsl(${hue} 68% 58%), hsl(${(hue + 40) % 360} 72% 44%))` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
