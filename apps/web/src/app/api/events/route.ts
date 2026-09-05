import { handler, ok, parseJson } from '@/lib/api';
import { RATE_LIMITS, enforce } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request';
import { analyticsEventSchema } from '@/lib/validation';
import { getRequestContext } from '@/server/context';
import { track } from '@/server/analytics/service';

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const context = await getRequestContext(request, { ensureAnon: true });
  await enforce(RATE_LIMITS.events, context.limitKey);

  const input = await parseJson(request, analyticsEventSchema);
  await track({
    ...input,
    userId: context.user?.id,
    anonId: context.anonId,
  });

  return ok({ tracked: true });
});
