import Link from 'next/link';
import { Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { defaultLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';

export default function NotFound() {
  // A not-found boundary cannot read route params, so it falls back to the
  // default locale; the link below returns the visitor to a localised page.
  const t = getDictionary(defaultLocale);

  return (
    <div className="py-16">
      <EmptyState
        icon={<Swords className="size-10" />}
        title={t.duel.notFound}
        hint={t.duel.notFoundHint}
        action={
          <Link href={`/${defaultLocale}`}>
            <Button>{t.duel.backHome}</Button>
          </Link>
        }
      />
    </div>
  );
}
