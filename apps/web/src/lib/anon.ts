import { randomUUID } from 'node:crypto';
import { env } from './env';
import { sign, unsign } from './crypto';

/**
 * Anonymous voter identity.
 *
 * Anonymous voting is a core product requirement, so every visitor gets a
 * signed random id in an httpOnly cookie. Signing means a client cannot mint
 * fresh identities by editing the cookie — it can only delete it, which is
 * equivalent to clearing cookies and is accepted (rate limiting and the IP
 * hash cover the rest).
 */
export function createAnonId(): string {
  return randomUUID();
}

export function signAnonId(anonId: string): string {
  return sign(anonId, env.ANON_SECRET);
}

/** Returns the anonymous id carried by a cookie value, or null if tampered. */
export function readAnonId(cookieValue: string | undefined | null): string | null {
  if (!cookieValue) return null;
  const value = unsign(cookieValue, env.ANON_SECRET);
  if (!value || value.length > 64) return null;
  return value;
}
