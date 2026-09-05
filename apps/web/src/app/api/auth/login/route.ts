import { handler, ok, parseJson } from '@/lib/api';
import { RATE_LIMITS, enforce } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request';
import { loginSchema } from '@/lib/validation';
import { getRequestContext } from '@/server/context';
import { login } from '@/server/auth/service';
import { pruneExpiredSessions } from '@/server/auth/session';

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const context = await getRequestContext(request);
  // Keyed by IP: an attacker must not be able to lock a victim out by
  // hammering their email address.
  await enforce(RATE_LIMITS.login, context.ipHash ?? 'unknown');

  const input = await parseJson(request, loginSchema);
  const user = await login(input, { userAgent: context.userAgent, ipHash: context.ipHash });

  // Housekeeping at a natural point in the session lifecycle. Fire-and-forget:
  // it must never delay or fail a sign-in.
  void pruneExpiredSessions().catch(() => undefined);

  return ok({ user });
});
