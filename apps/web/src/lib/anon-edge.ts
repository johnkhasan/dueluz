/**
 * Edge-runtime counterpart of `lib/anon.ts`.
 *
 * Middleware runs on the Edge runtime where `node:crypto` is unavailable, so
 * the anonymous-id signature is produced with Web Crypto instead. Both
 * implementations compute HMAC-SHA256 and encode it as unpadded base64url, so
 * a cookie signed here verifies in Node and vice versa.
 */
function base64url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

export async function signAnonIdEdge(anonId: string, secret: string): Promise<string> {
  return `${anonId}.${await hmac(anonId, secret)}`;
}

export async function isValidAnonCookie(cookieValue: string, secret: string): Promise<boolean> {
  const index = cookieValue.lastIndexOf('.');
  if (index <= 0) return false;
  const value = cookieValue.slice(0, index);
  if (value.length > 64) return false;
  return cookieValue.slice(index + 1) === (await hmac(value, secret));
}
