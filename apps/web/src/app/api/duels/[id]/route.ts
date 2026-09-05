import { handler, ok, parseJson } from '@/lib/api';
import { assertSameOrigin } from '@/lib/request';
import { updateDuelSchema } from '@/lib/validation';
import { assertCanModify, requireUser } from '@/server/auth/guards';
import { getViewer } from '@/server/context';
import { deleteDuel, getDuelBySlug, getDuelForOwner, updateDuel } from '@/server/duels/service';

type Params = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export const GET = handler(async (_request, { params }: Params) => {
  const { id } = await params;
  const viewer = await getViewer();
  const duel = await getDuelBySlug(id, { userId: viewer.user?.id, anonId: viewer.anonId });
  return ok({ duel });
});

export const PATCH = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const user = await requireUser();

  const existing = await getDuelForOwner(id);
  assertCanModify(user, existing.authorId);

  const input = await parseJson(request, updateDuelSchema);
  const duel = await updateDuel(id, input);
  return ok({ duel });
});

export const DELETE = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const user = await requireUser();

  const existing = await getDuelForOwner(id);
  assertCanModify(user, existing.authorId);

  await deleteDuel(id);
  return ok({ deleted: true });
});
