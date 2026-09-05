import { handler, ok, parseJson } from '@/lib/api';
import { assertSameOrigin } from '@/lib/request';
import { moderateCommentSchema } from '@/lib/validation';
import { requireRole } from '@/server/auth/guards';
import { moderateComment } from '@/server/admin/service';

type Params = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  await requireRole('MODERATOR');
  const { id } = await params;
  const { action } = await parseJson(request, moderateCommentSchema);

  await moderateComment(id, action);
  return ok({ updated: true });
});
