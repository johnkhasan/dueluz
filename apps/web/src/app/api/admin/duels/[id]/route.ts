import { handler, ok, parseJson } from '@/lib/api';
import { assertSameOrigin } from '@/lib/request';
import { moderateDuelSchema } from '@/lib/validation';
import { requireRole } from '@/server/auth/guards';
import { moderateDuel } from '@/server/admin/service';

type Params = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  await requireRole('MODERATOR');
  const { id } = await params;
  const { action, note } = await parseJson(request, moderateDuelSchema);

  await moderateDuel(id, action, note);
  return ok({ updated: true });
});
