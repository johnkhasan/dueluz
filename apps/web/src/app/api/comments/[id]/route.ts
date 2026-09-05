import { handler, ok } from '@/lib/api';
import { assertSameOrigin } from '@/lib/request';
import { requireUser } from '@/server/auth/guards';
import { deleteComment } from '@/server/comments/service';

type Params = { params: Promise<{ id: string }> };

export const DELETE = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const user = await requireUser();
  await deleteComment(id, user);
  return ok({ deleted: true });
});
