import { created, handler, parseJson } from '@/lib/api';
import { RATE_LIMITS, enforce } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request';
import { registerSchema } from '@/lib/validation';
import { getRequestContext } from '@/server/context';
import { register } from '@/server/auth/service';
import { track } from '@/server/analytics/service';

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const context = await getRequestContext(request);
  await enforce(RATE_LIMITS.register, context.limitKey);

  const input = await parseJson(request, registerSchema);
  const user = await register(input, {
    userAgent: context.userAgent,
    ipHash: context.ipHash,
  });

  await track({ name: 'registration', userId: user.id, locale: user.locale });
  return created({ user });
});
