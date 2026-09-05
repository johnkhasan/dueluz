import { handler, ok, parseJson } from '@/lib/api';
import { RATE_LIMITS, enforce } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request';
import { voteSchema } from '@/lib/validation';
import { getRequestContext, voterIdentity } from '@/server/context';
import { castVote } from '@/server/votes/service';
import { track } from '@/server/analytics/service';

type Params = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await getRequestContext(request, { ensureAnon: true });

  // Keyed by the network fingerprint rather than the cookie: deleting the anon
  // cookie must not reset the budget.
  await enforce(RATE_LIMITS.vote, context.ipHash ?? context.limitKey);

  const { optionId } = await parseJson(request, voteSchema);
  const result = await castVote(id, optionId, voterIdentity(context));

  await track({
    name: 'vote',
    userId: context.user?.id,
    anonId: context.anonId,
    duelId: id,
    props: { optionId, inMajority: result.inMajority },
  });

  return ok({ result });
});
