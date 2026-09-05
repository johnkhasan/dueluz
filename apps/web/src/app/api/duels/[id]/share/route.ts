import { handler, ok, parseJson } from '@/lib/api';
import { RATE_LIMITS, enforce } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request';
import { shareSchema } from '@/lib/validation';
import { getRequestContext } from '@/server/context';
import { recordShare } from '@/server/duels/shares';
import { track } from '@/server/analytics/service';

type Params = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await getRequestContext(request, { ensureAnon: true });
  await enforce(RATE_LIMITS.share, context.limitKey);

  const { channel } = await parseJson(request, shareSchema);
  const result = await recordShare(id, channel, {
    userId: context.user?.id,
    anonId: context.anonId,
  });

  await track({
    name: 'duel_shared',
    userId: context.user?.id,
    anonId: context.anonId,
    duelId: id,
    props: { channel },
  });

  return ok(result);
});
