import { created, handler, ok, parseJson, parseQuery } from '@/lib/api';
import { RATE_LIMITS, enforce } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request';
import { createDuelSchema, feedQuerySchema } from '@/lib/validation';
import { requireUser } from '@/server/auth/guards';
import { getRequestContext, getViewer } from '@/server/context';
import { createDuel, listDuels } from '@/server/duels/service';
import { track } from '@/server/analytics/service';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  const query = parseQuery(request, feedQuerySchema);
  const viewer = await getViewer();

  // Plain feed reads are cheap and indexed; a trigram search is not, so only
  // the search path carries a budget.
  if (query.q) {
    const context = await getRequestContext(request);
    await enforce(RATE_LIMITS.search, context.limitKey);
  }

  const { items, nextCursor } = await listDuels(query, {
    userId: viewer.user?.id,
    anonId: viewer.anonId,
  });

  return ok({ duels: items }, { nextCursor, feed: query.feed });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const user = await requireUser();
  const context = await getRequestContext(request);
  await enforce(RATE_LIMITS.duelCreate, user.id);

  const input = await parseJson(request, createDuelSchema);
  const duel = await createDuel(input, user.id);

  await track({
    name: 'duel_created',
    userId: user.id,
    duelId: duel.id,
    props: { category: duel.category.slug },
  });
  void context;

  return created({ duel });
});
