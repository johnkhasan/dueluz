'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { apiPost } from '@/lib/client/api';
import { miniAppInitData, miniAppReady } from '@/lib/client/telegram';

/** One attempt per Mini App launch, so a rejected identity cannot spin. */
const ATTEMPTED = 'dueluz:miniapp-auth';

function alreadyTried(): boolean {
  try {
    if (sessionStorage.getItem(ATTEMPTED)) return true;
    sessionStorage.setItem(ATTEMPTED, '1');
    return false;
  } catch {
    // Storage can be unavailable in an embedded webview. Falling back to
    // "already tried" is the safe direction: worse sign-in, never a reload loop.
    return true;
  }
}

/**
 * Signs a Mini App visitor in without them asking.
 *
 * Rendered only for signed-out visitors. Inside Telegram the identity is
 * already present in the page, so making someone tap a login button to hand
 * over what the client has already given us is pure friction. On the open web
 * `initData` is absent and this renders nothing at all.
 *
 * A failure is deliberately silent: the visitor can still read and vote
 * anonymously. The login page is left out entirely — `<TelegramLogin>` runs the
 * same sign-in there and, unlike this, shows the visitor what went wrong.
 */
export function MiniAppAuth() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.endsWith('/login')) return;

    const initData = miniAppInitData();
    if (!initData) return;

    miniAppReady();
    if (alreadyTried()) return;

    void apiPost('/api/auth/telegram', { source: 'miniapp', initData })
      // The session cookie changes what every layout renders, so the page has
      // to come back from the server rather than be patched in place.
      .then(() => window.location.reload())
      .catch(() => undefined);
  }, [pathname]);

  return null;
}
