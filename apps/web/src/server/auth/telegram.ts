import { createHash, createHmac } from 'node:crypto';
import { AppError } from '@/lib/errors';
import { safeEqual } from '@/lib/crypto';
import { env } from '@/lib/env';
import type { TelegramInitDataInput, TelegramWidgetInput } from '@/lib/validation';

/**
 * Telegram sign-in verification.
 *
 * Both entry points — the website Login Widget and a Mini App's `initData` —
 * hand the browser a payload signed with a key derived from the bot token.
 * Because the browser is holding it, the payload is fully attacker-controlled
 * until the HMAC checks out: everything below treats it as hostile input, and
 * nothing reaches the database before the signature and the freshness window
 * have both passed.
 *
 * The two flows differ only in how the signing key is derived, which is why
 * they share one checker.
 *
 * https://core.telegram.org/widgets/login#checking-authorization
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

/** The widget posts within seconds; a long window only widens replay. */
const WIDGET_MAX_AGE_SECONDS = 15 * 60;
/**
 * `initData` is minted once when the Mini App opens and stays valid for as long
 * as that window lives, so it has to tolerate a session left open for a while.
 * This is Telegram's own recommended ceiling.
 */
const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

/** A verified Telegram identity. Every field here has been signature-checked. */
export type TelegramProfile = {
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  /** Telegram's `language_code`, mapped onto a locale the app actually has. */
  locale: 'uz' | 'ru' | 'en' | null;
};

function botToken(): string {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    // A misconfigured deploy must not look like a rejected login: that would
    // send users round the sign-in loop forever with no way to tell why.
    throw new AppError('INTERNAL_ERROR', 'Telegram sign-in is not configured');
  }
  return token;
}

/**
 * `key=value` lines, sorted by key, newline-joined — the exact string Telegram
 * signed. Any field we forget to include is a field an attacker may forge, so
 * this deliberately takes everything it is given rather than a known list.
 */
function dataCheckString(fields: Record<string, string>): string {
  return Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
}

function assertSignature(fields: Record<string, string>, hash: string, secret: Buffer): void {
  const expected = createHmac('sha256', secret).update(dataCheckString(fields)).digest('hex');
  if (!safeEqual(hash.toLowerCase(), expected)) {
    throw new AppError('INVALID_CREDENTIALS', 'Telegram signature is invalid');
  }
}

function assertFresh(authDate: number, maxAgeSeconds: number): void {
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  // A negative age means a clock skew, not an attack; only a stale payload is
  // rejected, and generously enough that a slightly fast client still works.
  if (ageSeconds > maxAgeSeconds) {
    throw new AppError('SESSION_EXPIRED', 'This Telegram login has expired. Please try again.');
  }
}

/** Telegram sends BCP-47-ish codes; anything we do not translate stays null. */
function toLocale(code: string | null | undefined): TelegramProfile['locale'] {
  const base = code?.slice(0, 2).toLowerCase();
  return base === 'uz' || base === 'ru' || base === 'en' ? base : null;
}

/**
 * Only Telegram's own CDN may supply an avatar URL. Without this an attacker
 * who could forge a payload — or a future flow that skips a check — could point
 * every profile picture at a host of their choosing.
 */
function safePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const telegramHost =
      parsed.protocol === 'https:' &&
      (parsed.hostname === 't.me' || parsed.hostname.endsWith('.telegram.org'));
    return telegramHost ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Login Widget payload (`data-onauth`).
 * Signing key: SHA-256 of the bot token.
 */
export function verifyWidgetLogin(input: TelegramWidgetInput): TelegramProfile {
  const { hash, ...rest } = input;

  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && value !== null) fields[key] = String(value);
  }

  assertSignature(fields, hash, createHash('sha256').update(botToken()).digest());
  assertFresh(input.auth_date, WIDGET_MAX_AGE_SECONDS);

  return {
    telegramId: String(input.id),
    firstName: input.first_name,
    lastName: input.last_name ?? null,
    username: input.username ?? null,
    photoUrl: safePhotoUrl(input.photo_url),
    locale: null, // the widget does not report a language
  };
}

/**
 * Mini App `window.Telegram.WebApp.initData` — a raw query string.
 * Signing key: HMAC-SHA256 of the bot token under the constant "WebAppData".
 */
export function verifyInitData(input: TelegramInitDataInput): TelegramProfile {
  const params = new URLSearchParams(input.initData);

  const hash = params.get('hash');
  if (!hash) throw new AppError('INVALID_CREDENTIALS', 'Telegram payload is incomplete');

  const fields: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    // `hash` is the signature itself; `signature` is Telegram's separate
    // third-party Ed25519 field, which their spec excludes from this digest.
    if (key === 'hash' || key === 'signature') continue;
    fields[key] = value;
  }

  const secret = createHmac('sha256', 'WebAppData').update(botToken()).digest();
  assertSignature(fields, hash, secret);

  const authDate = Number(fields.auth_date);
  if (!Number.isFinite(authDate)) {
    throw new AppError('INVALID_CREDENTIALS', 'Telegram payload is incomplete');
  }
  assertFresh(authDate, INIT_DATA_MAX_AGE_SECONDS);

  // Parsed only after the signature passed, so this JSON is Telegram's.
  let user: {
    id?: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    language_code?: string;
  };
  try {
    user = JSON.parse(fields.user ?? '');
  } catch {
    throw new AppError('INVALID_CREDENTIALS', 'Telegram payload has no user');
  }

  if (!user.id || !user.first_name) {
    throw new AppError('INVALID_CREDENTIALS', 'Telegram payload has no user');
  }

  return {
    telegramId: String(user.id),
    firstName: user.first_name,
    lastName: user.last_name ?? null,
    username: user.username ?? null,
    photoUrl: safePhotoUrl(user.photo_url),
    locale: toLocale(user.language_code),
  };
}
