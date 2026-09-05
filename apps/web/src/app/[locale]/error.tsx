'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';
import { useI18n } from '@/components/providers/i18n-provider';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error('[ui] route error', error);
  }, [error]);

  return (
    <div className="py-16">
      <ErrorState
        title={t.common.somethingWrong}
        hint={t.common.tryAgain}
        action={<Button onClick={reset}>{t.common.retry}</Button>}
      />
    </div>
  );
}
