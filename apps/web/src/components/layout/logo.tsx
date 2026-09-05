import { cn } from '@/lib/utils';

/**
 * The mark is the duel itself: two blocks meeting at a slash. It reads at
 * 20px in the mobile header and scales to the OG image without a raster asset.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden
        className="brand-gradient inline-flex size-8 items-center justify-center rounded-[0.6rem] text-[13px] font-black text-white"
      >
        VS
      </span>
      <span className="text-fg text-[17px] font-black tracking-tight">
        Duel<span className="brand-text">.uz</span>
      </span>
    </span>
  );
}
