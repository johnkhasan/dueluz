'use client';

import { useState } from 'react';
import { Check, Link2, Send, Share2, Twitter, MessageCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/providers/i18n-provider';
import { useToast } from '@/components/ui/toast';
import { apiPost, trackEvent } from '@/lib/client/api';
import { cn } from '@/lib/utils';

type Channel = 'COPY' | 'TELEGRAM' | 'WHATSAPP' | 'X' | 'NATIVE';

export function ShareSheet({
  open,
  onClose,
  duelId,
  url,
  optionA,
  optionB,
  prompt,
}: {
  open: boolean;
  onClose: () => void;
  duelId: string;
  url: string;
  optionA: string;
  optionB: string;
  /** Result-aware line shown above the buttons, e.g. "You voted for X...". */
  prompt?: string;
}) {
  const { t, fill, locale } = useI18n();
  const { show } = useToast();
  const [copied, setCopied] = useState(false);

  const message = fill(t.share.message, { a: optionA, b: optionB });

  function record(channel: Channel) {
    void apiPost(`/api/duels/${duelId}/share`, { channel }).catch(() => undefined);
    trackEvent('duel_shared', { duelId, locale, props: { channel } });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      show(t.common.somethingWrong, 'error');
      return;
    }
    record('COPY');
    setCopied(true);
    show(t.share.linkCopied, 'success');
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareNative() {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: message, text: message, url });
      record('NATIVE');
    } catch {
      // The user dismissed the sheet; nothing to report.
    }
  }

  const targets: { channel: Channel; label: string; href: string; Icon: typeof Send; tone: string }[] = [
    {
      channel: 'TELEGRAM',
      label: t.share.telegram,
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`,
      Icon: Send,
      tone: 'bg-[#229ED9] text-white',
    },
    {
      channel: 'WHATSAPP',
      label: t.share.whatsapp,
      href: `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`,
      Icon: MessageCircle,
      tone: 'bg-[#25D366] text-white',
    },
    {
      channel: 'X',
      label: t.share.x,
      href: `https://x.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`,
      Icon: Twitter,
      tone: 'bg-black text-white',
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.duel.shareTitle}
      description={prompt}
      testId="share-dialog"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {targets.map(({ channel, label, href, Icon, tone }) => (
            <a
              key={channel}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => record(channel)}
              className="border-border hover:bg-surface-muted flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors"
            >
              <span className={cn('flex size-10 items-center justify-center rounded-full', tone)}>
                <Icon className="size-5" />
              </span>
              <span className="text-xs font-semibold">{label}</span>
            </a>
          ))}
        </div>

        <div className="border-border bg-surface-muted flex items-center gap-2 rounded-xl border p-2">
          <span className="text-fg-muted min-w-0 flex-1 truncate px-2 text-xs">{url}</span>
          <Button size="sm" variant="secondary" onClick={copyLink}>
            {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
            {copied ? t.common.copied : t.common.copy}
          </Button>
        </div>

        {typeof navigator !== 'undefined' && 'share' in navigator ? (
          <Button fullWidth variant="outline" onClick={shareNative}>
            <Share2 className="size-4" />
            {t.share.native}
          </Button>
        ) : null}
      </div>
    </Dialog>
  );
}
