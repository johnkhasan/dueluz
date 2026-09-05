'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useI18n } from '@/components/providers/i18n-provider';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiDelete, apiPost } from '@/lib/client/api';

/**
 * One-shot moderation action.
 *
 * Every admin mutation is a POST to `/api/admin/...` that re-checks the actor's
 * role on the server; this button is only the trigger, never the authority.
 */
export function ActionButton({
  endpoint,
  body,
  confirm,
  children,
  method = 'POST',
  variant = 'secondary',
  size = 'sm',
  successMessage,
}: {
  endpoint: string;
  body?: unknown;
  confirm?: string;
  children: React.ReactNode;
  method?: 'POST' | 'DELETE';
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  successMessage?: string;
}) {
  const router = useRouter();
  const { t, errorMessage } = useI18n();
  const { show } = useToast();
  const [pending, setPending] = useState(false);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setPending(true);

    try {
      await (method === 'DELETE' ? apiDelete(endpoint, body) : apiPost(endpoint, body));
      show(successMessage ?? t.common.save, 'success');
      router.refresh();
    } catch (error) {
      show(
        error instanceof ApiClientError ? errorMessage(error.code, error.message) : errorMessage(undefined),
        'error',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant={variant} size={size} loading={pending} onClick={run}>
      {children}
    </Button>
  );
}
