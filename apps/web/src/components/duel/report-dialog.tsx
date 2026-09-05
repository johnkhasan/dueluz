'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { useI18n } from '@/components/providers/i18n-provider';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiPost } from '@/lib/client/api';
import { cn } from '@/lib/utils';

const REASONS = ['SPAM', 'NSFW', 'HATE', 'HARASSMENT', 'COPYRIGHT', 'MISINFORMATION', 'OTHER'] as const;
type Reason = (typeof REASONS)[number];

export function ReportDialog({
  open,
  onClose,
  target,
  id,
}: {
  open: boolean;
  onClose: () => void;
  target: 'duel' | 'comment';
  id: string;
}) {
  const { t, errorMessage } = useI18n();
  const { show } = useToast();
  const [reason, setReason] = useState<Reason>('SPAM');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const labels: Record<Reason, string> = {
    SPAM: t.report.reasonSPAM,
    NSFW: t.report.reasonNSFW,
    HATE: t.report.reasonHATE,
    HARASSMENT: t.report.reasonHARASSMENT,
    COPYRIGHT: t.report.reasonCOPYRIGHT,
    MISINFORMATION: t.report.reasonMISINFORMATION,
    OTHER: t.report.reasonOTHER,
  };

  async function submit() {
    setSubmitting(true);
    try {
      await apiPost(`/api/${target === 'duel' ? 'duels' : 'comments'}/${id}/report`, {
        reason,
        details,
      });
      show(t.report.sent, 'success');
      setDetails('');
      onClose();
    } catch (error) {
      show(
        error instanceof ApiClientError ? errorMessage(error.code, error.message) : errorMessage(undefined),
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t.report.title} description={t.report.subtitle}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {REASONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setReason(value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                reason === value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-fg-muted hover:bg-surface-muted',
              )}
            >
              {labels[value]}
            </button>
          ))}
        </div>

        <Textarea
          label={t.report.details}
          placeholder={t.report.detailsPlaceholder}
          value={details}
          maxLength={500}
          onChange={(event) => setDetails(event.target.value)}
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={submit} loading={submitting}>
            {t.report.submit}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
