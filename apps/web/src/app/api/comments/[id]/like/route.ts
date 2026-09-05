import { handler, ok } from '@/lib/api';
import { RATE_LIMITS, enforce } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request';
import { requireUser } from '@/server/auth/guards';
import { likeComment } from '@/server/likes/service';

type Params = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const user = await requireUser();
  await enforce(RATE_LIMITS.commentLike, user.id);

  return ok(await likeComment(id, user.id));
});
