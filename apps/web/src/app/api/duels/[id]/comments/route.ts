import { created, handler, ok, parseJson, parseQuery } from '@/lib/api';
import { RATE_LIMITS, enforce } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request';
import { commentSchema, paginationSchema } from '@/lib/validation';
import { requireUser } from '@/server/auth/guards';
import { getViewer } from '@/server/context';
import { createComment, listComments } from '@/server/comments/service';
import { track } from '@/server/analytics/service';

type Params = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export const GET = handler(async (request, { params }: Params) => {
  const { id } = await params;
  const { cursor, limit } = parseQuery(request, paginationSchema);
  const viewer = await getViewer();

  const { items, nextCursor } = await listComments(id, viewer.user, { cursor, limit });
  return ok({ comments: items }, { nextCursor });
});

export const POST = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const user = await requireUser();
  await enforce(RATE_LIMITS.comment, user.id);

  const { content } = await parseJson(request, commentSchema);
  const comment = await createComment(id, user, content);

  await track({ name: 'comment_created', userId: user.id, duelId: id });
  return created({ comment });
});
