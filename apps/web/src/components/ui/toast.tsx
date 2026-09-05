'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<{ show: (message: string, tone?: Tone) => void } | null>(null);

const ICONS: Record<Tone, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const TONES: Record<Tone, string> = {
  success: 'border-success/40 text-success',
  error: 'border-danger/40 text-danger',
  info: 'border-border text-fg',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3600);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <div
              key={toast.id}
              className={cn(
                'bg-surface shadow-pop animate-rise pointer-events-auto flex items-center gap-2.5',
                'max-w-sm rounded-xl border px-4 py-3 text-sm font-medium',
                TONES[toast.tone],
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="text-fg">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
