import { handler, ok, parseJson } from '@/lib/api';
import { assertSameOrigin } from '@/lib/request';
import { moderateUserSchema } from '@/lib/validation';
import { requireRole } from '@/server/auth/guards';
import { moderateUser } from '@/server/admin/service';

type Params = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  const actor = await requireRole('MODERATOR');
  const { id } = await params;
  const input = await parseJson(request, moderateUserSchema);

  await moderateUser(id, actor, input.action, { reason: input.reason, days: input.days });
  return ok({ updated: true });
});
