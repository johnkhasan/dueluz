import { handler, ok } from '@/lib/api';
import { RATE_LIMITS, enforce } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request';
import { requireUser } from '@/server/auth/guards';
import { likeDuel, unlikeDuel } from '@/server/likes/service';
import { track } from '@/server/analytics/service';

type Params = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const user = await requireUser();
  await enforce(RATE_LIMITS.duelLike, user.id);

  const result = await likeDuel(id, user.id);
  await track({ name: 'duel_liked', userId: user.id, duelId: id });
  return ok(result);
});

export const DELETE = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const user = await requireUser();
  await enforce(RATE_LIMITS.duelLike, user.id);

  return ok(await unlikeDuel(id, user.id));
});
