'use client';

import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const CONTROL =
  'w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-fg ' +
  'placeholder:text-fg-subtle transition-colors ' +
  'focus:border-ring focus:ring-2 focus:ring-ring/25 outline-none ' +
  'disabled:opacity-60 disabled:cursor-not-allowed ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/25';

type FieldShellProps = {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (id: string) => React.ReactNode;
};

export function Field({ label, hint, error, required, children }: FieldShellProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={id} className="text-fg block text-sm font-medium">
          {label}
          {required ? <span className="text-danger ml-0.5">*</span> : null}
        </label>
      ) : null}
      {children(id)}
      {error ? (
        <p className="text-danger text-xs" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-fg-subtle text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, required, ...props },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(id) => (
        <input
          {...props}
          id={id}
          ref={ref}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, className)}
        />
      )}
    </Field>
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, required, ...props },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(id) => (
        <textarea
          {...props}
          id={id}
          ref={ref}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, 'min-h-24 resize-y', className)}
        />
      )}
    </Field>
  );
});
