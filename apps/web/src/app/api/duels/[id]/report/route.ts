import { created, handler, parseJson } from '@/lib/api';
import { RATE_LIMITS, enforce } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request';
import { reportSchema } from '@/lib/validation';
import { getRequestContext } from '@/server/context';
import { reportDuel } from '@/server/reports/service';

type Params = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await getRequestContext(request, { ensureAnon: true });
  await enforce(RATE_LIMITS.report, context.limitKey);

  const { reason, details } = await parseJson(request, reportSchema);
  await reportDuel(id, reason, details || undefined, {
    userId: context.user?.id,
    anonId: context.anonId,
  });

  return created({ reported: true });
});
