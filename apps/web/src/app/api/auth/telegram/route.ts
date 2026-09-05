import { handler, ok, parseJson } from '@/lib/api';
import { RATE_LIMITS, enforce } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request';
import { telegramLoginSchema } from '@/lib/validation';
import { getRequestContext } from '@/server/context';
import { loginWithTelegram } from '@/server/auth/service';
import { pruneExpiredSessions } from '@/server/auth/session';
import { verifyInitData, verifyWidgetLogin } from '@/server/auth/telegram';
import { track } from '@/server/analytics/service';

/**
 * The single sign-in endpoint: a signature-checked Telegram identity in, a
 * session cookie out. First contact creates the account, so this is also the
 * registration endpoint — the client cannot tell, and does not need to.
 */
export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const context = await getRequestContext(request);
  // Keyed by IP. Every payload here is HMAC-verified, so this is only a brake
  // on someone grinding forged signatures, never a lockout of a real account.
  await enforce(RATE_LIMITS.telegramAuth, context.ipHash ?? 'unknown');

  const input = await parseJson(request, telegramLoginSchema);
  const profile =
    input.source === 'widget' ? verifyWidgetLogin(input.payload) : verifyInitData(input);

  const { user, created } = await loginWithTelegram(profile, {
    userAgent: context.userAgent,
    ipHash: context.ipHash,
  });

  if (created) {
    await track({ name: 'registration', userId: user.id, locale: user.locale });
  }

  // Housekeeping at a natural point in the session lifecycle. Fire-and-forget:
  // it must never delay or fail a sign-in.
  void pruneExpiredSessions().catch(() => undefined);

  return ok({ user });
});
