import { handler, ok, parseJson } from '@/lib/api';
import { assertSameOrigin } from '@/lib/request';
import { resolveReportSchema } from '@/lib/validation';
import { requireRole } from '@/server/auth/guards';
import { resolveReport } from '@/server/admin/service';

type Params = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  const actor = await requireRole('MODERATOR');
  const { id } = await params;
  const { action, note } = await parseJson(request, resolveReportSchema);

  await resolveReport(id, actor.id, action, note);
  return ok({ updated: true });
});
