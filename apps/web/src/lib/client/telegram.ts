'use client';

/**
 * Browser-side glue for the two Telegram surfaces.
 *
 * Everything here is untrusted convenience: the payloads it reads are only ever
 * relayed to the server, which re-derives the HMAC before believing a word of
 * them.
 */

/** The shape Telegram's Login Widget passes to its `data-onauth` callback. */
export type TelegramWidgetUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/**
 * The signed `initData` string when the page is running inside Telegram, null
 * on the open web.
 *
 * Telegram injects an empty string when the Mini App was opened in a way that
 * carries no identity (a direct link preview, for instance), which is why an
 * empty value counts as "not in a Mini App" rather than as a payload.
 */
export function miniAppInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const initData = window.Telegram?.WebApp?.initData;
  return initData && initData.length > 0 ? initData : null;
}

/** Tells the Telegram client the Mini App has painted. Safe to call anywhere. */
export function miniAppReady(): void {
  window.Telegram?.WebApp?.ready?.();
}
