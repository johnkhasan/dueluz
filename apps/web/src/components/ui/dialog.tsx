'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Modal built on <dialog>, so focus trapping, Escape handling and the top-layer
 * stacking come from the platform instead of a dependency.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    element.addEventListener('cancel', handleCancel);
    return () => element.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      data-testid={testId}
      aria-labelledby="dialog-title"
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'bg-surface text-fg shadow-pop m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl p-0',
        'backdrop:bg-black/50 backdrop:backdrop-blur-sm',
        'open:animate-pop',
        className,
      )}
    >
      <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <h2 id="dialog-title" className="text-base font-bold">
            {title}
          </h2>
          {description ? <p className="text-fg-muted mt-1 text-sm">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-fg-subtle hover:bg-surface-muted hover:text-fg -mr-1 rounded-lg p-1.5 transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
