import { cookies } from 'next/headers';
import { prisma, type Role, type UserStatus } from '@dueluz/db';
import { COOKIES, SESSION_MAX_AGE_SECONDS } from '@/lib/cookies';
import { randomToken, sha256 } from '@/lib/crypto';
import { useSecureCookies } from '@/lib/env';

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  locale: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
};

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  locale: true,
  role: true,
  status: true,
  bannedUntil: true,
  createdAt: true,
} as const;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

/**
 * Mints a session row and returns the raw token.
 *
 * Only the token's SHA-256 hash is persisted, so a database leak cannot be
 * replayed as a login. Kept separate from cookie writing so a caller without a
 * request scope - a test, or a future OAuth callback - can issue a session.
 */
export async function issueSession(
  userId: string,
  meta: { userAgent?: string | null; ipHash?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      userAgent: meta.userAgent ?? null,
      ipHash: meta.ipHash ?? null,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/** Writes the session cookie. Requires a request scope. */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIES.session, token, cookieOptions(SESSION_MAX_AGE_SECONDS));
}

/** Issues a session and puts it in the browser's cookie jar. */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipHash?: string | null } = {},
): Promise<string> {
  const { token } = await issueSession(userId, meta);
  await setSessionCookie(token);
  return token;
}

/**
 * Resolves the current user from the session cookie.
 * Returns null (never throws) so callers decide whether auth is required.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIES.session)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: { id: true, expiresAt: true, user: { select: USER_SELECT } },
  });

  if (!session || session.expiresAt <= new Date()) return null;

  const { user } = session;
  if (user.status === 'BANNED' && (!user.bannedUntil || user.bannedUntil > new Date())) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    locale: user.locale,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

/** Revokes the current session and clears the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIES.session)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  store.set(COOKIES.session, '', cookieOptions(0));
}

/** Revokes every session of a user — used by "log out everywhere" and bans. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/** Housekeeping for expired rows. Safe to call opportunistically. */
export async function pruneExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return count;
}
