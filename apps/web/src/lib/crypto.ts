import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

/** URL-safe random token. 32 bytes ≈ 256 bits of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Stored form of a session token. Fast (not a password) but irreversible. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmac(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Privacy-preserving IP fingerprint.
 *
 * Raw IP addresses are never stored. The daily salt rotation means a stored
 * hash cannot be correlated across days, while still allowing same-day abuse
 * detection.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  return createHmac('sha256', `${env.IP_SALT}:${day}`)
    .update(ip.trim().toLowerCase())
    .digest('hex')
    .slice(0, 32);
}

/** Signs a value as `<value>.<hmac>` so tampering is detectable. */
export function sign(value: string, secret: string): string {
  return `${value}.${hmac(value, secret)}`;
}

/** Returns the payload of a signed value, or null when the signature fails. */
export function unsign(signed: string, secret: string): string | null {
  const index = signed.lastIndexOf('.');
  if (index <= 0) return null;
  const value = signed.slice(0, index);
  const signature = signed.slice(index + 1);
  if (!safeEqual(signature, hmac(value, secret))) return null;
  return value;
}
