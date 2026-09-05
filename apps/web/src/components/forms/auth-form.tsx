'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useI18n } from '@/components/providers/i18n-provider';
import { ApiClientError, apiPost, trackEvent } from '@/lib/client/api';
import { loginSchema, registerSchema } from '@/lib/validation';
import { usernameFromEmail } from '@/lib/slug';

type Mode = 'login' | 'register';

/**
 * Login and registration share one component because they share one flow: the
 * only differences are which fields show and which endpoint is called.
 *
 * Client-side validation reuses the exact zod schemas the API enforces, so the
 * two can never disagree - but the server is still the authority.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const { locale, t, errorMessage } = useI18n();
  const searchParams = useSearchParams();

  const [values, setValues] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set(field: keyof typeof values, value: string) {
    setValues((current) => {
      const next = { ...current, [field]: value };
      // Suggest a username from the email so registration stays one screen.
      if (mode === 'register' && field === 'email' && !current.username) {
        next.username = usernameFromEmail(value);
      }
      return next;
    });
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const schema = mode === 'login' ? loginSchema : registerSchema;
    const parsed = schema.safeParse(
      mode === 'login'
        ? { email: values.email, password: values.password }
        : { ...values, locale },
    );

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await apiPost(`/api/auth/${mode}`, parsed.data);
      if (mode === 'register') trackEvent('registration', { locale });

      // Only same-origin paths are honoured, so `?next=` cannot be used as an
      // open redirect.
      const next = searchParams.get('next');
      const destination = next && next.startsWith('/') && !next.startsWith('//')
        ? next
        : `/${locale}`;

      // A full navigation rather than router.push + router.refresh: the session
      // cookie changes what every layout renders, and a hard load guarantees no
      // cached RSC payload from the signed-out state survives.
      window.location.assign(destination);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrors(error.fieldErrors);
        setFormError(errorMessage(error.code, error.message));
      } else {
        setFormError(errorMessage(undefined));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {formError ? (
        <p
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-xl border px-3.5 py-2.5 text-sm font-medium"
        >
          {formError}
        </p>
      ) : null}

      <Input
        type="email"
        name="email"
        autoComplete="email"
        required
        label={t.auth.email}
        placeholder={t.auth.emailPlaceholder}
        value={values.email}
        error={errors.email}
        onChange={(event) => set('email', event.target.value)}
      />

      {mode === 'register' ? (
        <>
          <Input
            name="displayName"
            autoComplete="name"
            required
            label={t.auth.displayName}
            placeholder={t.auth.displayNamePlaceholder}
            value={values.displayName}
            error={errors.displayName}
            onChange={(event) => set('displayName', event.target.value)}
          />
          <Input
            name="username"
            autoComplete="username"
            required
            label={t.auth.username}
            hint={t.auth.usernameHint}
            value={values.username}
            error={errors.username}
            onChange={(event) => set('username', event.target.value)}
          />
        </>
      ) : null}

      <Input
        type="password"
        name="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        required
        label={t.auth.password}
        hint={mode === 'register' ? t.auth.passwordHint : undefined}
        value={values.password}
        error={errors.password}
        onChange={(event) => set('password', event.target.value)}
      />

      <Button type="submit" fullWidth size="lg" loading={submitting}>
        {mode === 'login' ? t.auth.submitLogin : t.auth.submitRegister}
      </Button>

      <p className="text-fg-muted text-center text-sm">
        {mode === 'login' ? t.auth.noAccount : t.auth.hasAccount}{' '}
        <Link
          href={`/${locale}/${mode === 'login' ? 'register' : 'login'}`}
          className="text-accent font-semibold hover:underline"
        >
          {mode === 'login' ? t.auth.submitRegister : t.auth.submitLogin}
        </Link>
      </p>
    </form>
  );
}
