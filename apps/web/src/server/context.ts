import { cookies } from 'next/headers';
import { createAnonId, readAnonId, signAnonId } from '@/lib/anon';
import { ANON_MAX_AGE_SECONDS, COOKIES } from '@/lib/cookies';
import { useSecureCookies } from '@/lib/env';
import { hashIp } from '@/lib/crypto';
import { clientIp, userAgent } from '@/lib/request';
import { currentUser, type SessionUser } from './auth/guards';

export type Viewer = {
  user: SessionUser | null;
  anonId: string | null;
};

export type RequestContext = Viewer & {
  ipHash: string | null;
  userAgent: string | null;
  /** Rate-limit key: the account when signed in, otherwise the IP fingerprint. */
  limitKey: string;
};

/**
 * Who is reading. Used by every Server Component that needs "have I voted".
 */
export async function getViewer(): Promise<Viewer> {
  const store = await cookies();
  const [user] = await Promise.all([currentUser()]);
  return {
    user,
    anonId: readAnonId(store.get(COOKIES.anon)?.value),
  };
}

/**
 * Mints the anonymous identity when the caller does not have one yet.
 *
 * Middleware already issues this cookie on page loads, but an API call can
 * arrive without one (cleared cookies, a direct client, a bookmarked SPA
 * route). Anonymous voting is a core requirement, so the write path creates
 * the identity itself rather than failing.
 */
export async function ensureAnonId(): Promise<string> {
  const store = await cookies();
  const existing = readAnonId(store.get(COOKIES.anon)?.value);
  if (existing) return existing;

  const anonId = createAnonId();
  store.set(COOKIES.anon, signAnonId(anonId), {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: ANON_MAX_AGE_SECONDS,
  });
  return anonId;
}

/**
 * Full request context for a route handler: identity plus the privacy-preserving
 * network fingerprints used for abuse control.
 *
 * Pass `ensureAnon` on routes that must work for a first-time anonymous
 * visitor (voting, sharing, reporting).
 */
export async function getRequestContext(
  request: Request,
  options: { ensureAnon?: boolean } = {},
): Promise<RequestContext> {
  const viewer = await getViewer();
  const ipHash = hashIp(clientIp(request));

  if (options.ensureAnon && !viewer.user && !viewer.anonId) {
    viewer.anonId = await ensureAnonId();
  }

  return {
    ...viewer,
    ipHash,
    userAgent: userAgent(request),
    limitKey: viewer.user?.id ?? ipHash ?? viewer.anonId ?? 'unknown',
  };
}

/** Voter identity, preferring the account over the anonymous cookie. */
export function voterIdentity(context: Viewer & { ipHash?: string | null }) {
  return {
    userId: context.user?.id ?? null,
    anonId: context.user ? null : context.anonId,
    ipHash: context.ipHash ?? null,
  };
}
