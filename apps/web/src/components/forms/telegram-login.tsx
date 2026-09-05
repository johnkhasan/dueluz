'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/components/providers/i18n-provider';
import { ApiClientError, apiPost } from '@/lib/client/api';
import { miniAppInitData, miniAppReady, type TelegramWidgetUser } from '@/lib/client/telegram';

/**
 * The only way into an account: Telegram's official Login Widget.
 *
 * The widget is an iframe served by Telegram, which is the point — the
 * credential exchange happens in Telegram's own origin and this page only ever
 * receives the signed result, which the server then re-verifies.
 *
 * Inside a Mini App there is no button: Telegram has already put a signed
 * identity in the page, so sign-in starts on its own. `<MiniAppAuth>` does the
 * same thing silently on every other page and steps aside here, where a failure
 * needs to be visible rather than swallowed.
 */
export function TelegramLogin({ botUsername }: { botUsername: string }) {
  const { locale, t, errorMessage } = useI18n();
  const searchParams = useSearchParams();

  const container = useRef<HTMLDivElement>(null);
  const [inMiniApp, setInMiniApp] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(
    async (body: unknown) => {
      setPending(true);
      setError(null);
      try {
        await apiPost('/api/auth/telegram', body);

        // Only same-origin paths are honoured, so `?next=` cannot be used as an
        // open redirect.
        const next = searchParams.get('next');
        const destination =
          next && next.startsWith('/') && !next.startsWith('//') ? next : `/${locale}`;

        // A full navigation rather than router.push + router.refresh: the
        // session cookie changes what every layout renders, and a hard load
        // guarantees no cached RSC payload from the signed-out state survives.
        window.location.assign(destination);
      } catch (cause) {
        setPending(false);
        setError(
          cause instanceof ApiClientError
            ? errorMessage(cause.code, cause.message)
            : errorMessage(undefined),
        );
      }
    },
    [searchParams, locale, errorMessage],
  );

  // Which surface this is can only be known in the browser, so the Mini App
  // branch is resolved after mount; rendering it during SSR would be a
  // hydration mismatch.
  useEffect(() => {
    const initData = miniAppInitData();
    if (!initData) return;
    setInMiniApp(true);
    miniAppReady();
    void signIn({ source: 'miniapp', initData });
  }, [signIn]);

  useEffect(() => {
    const node = container.current;
    if (!node || !botUsername || inMiniApp) return;

    // The widget calls a *global* function by name, so one has to exist. It is
    // namespaced and torn down with the component so no handler outlives the
    // page it belongs to.
    const callbackName = '__dueluzTelegramAuth';
    (window as unknown as Record<string, unknown>)[callbackName] = (user: TelegramWidgetUser) => {
      void signIn({ source: 'widget', payload: user });
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-userpic', 'true');
    // An unsupported code falls back to Telegram's own default, so the app's
    // locale can be passed straight through.
    script.setAttribute('data-lang', locale);
    script.setAttribute('data-onauth', `${callbackName}(user)`);
    node.appendChild(script);

    return () => {
      node.replaceChildren();
      delete (window as unknown as Record<string, unknown>)[callbackName];
    };
  }, [botUsername, locale, inMiniApp, signIn]);

  if (!botUsername) {
    // Configuration, not a user error — say so plainly instead of leaving an
    // empty box where the sign-in button should be.
    return (
      <p
        role="alert"
        className="border-danger/30 bg-danger/5 text-danger rounded-xl border px-3.5 py-2.5 text-sm font-medium"
      >
        {t.auth.telegramNotConfigured}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-xl border px-3.5 py-2.5 text-sm font-medium"
        >
          {error}
        </p>
      ) : null}

      <div className="flex min-h-[3.25rem] items-center justify-center" aria-busy={pending}>
        <p className="text-fg-muted text-sm font-medium" hidden={!pending}>
          {t.auth.telegramConnecting}
        </p>
        {/* Hidden rather than unmounted: the widget script is injected once, so
            a re-render after a failed attempt must not throw the button away. */}
        <div ref={container} hidden={pending || inMiniApp} />
      </div>

      <p className="text-fg-subtle text-center text-xs">{t.auth.telegramPrivacy}</p>
    </div>
  );
}
