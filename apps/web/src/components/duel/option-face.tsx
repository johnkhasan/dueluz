import Image from 'next/image';
import { cn, gradientFor } from '@/lib/utils';

/**
 * The visual face of one option: its image, or a deterministic gradient in the
 * side's colour family when it has none. Every duel looks intentional even
 * when nobody uploaded a picture.
 */
export function OptionFace({
  name,
  imageUrl,
  side,
  className,
  priority,
  sizes = '(max-width: 640px) 50vw, 300px',
}: {
  name: string;
  imageUrl: string | null;
  side: 'a' | 'b';
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: gradientFor(name, side) }}
          aria-hidden
        />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent"
        aria-hidden
      />
    </div>
  );
}
