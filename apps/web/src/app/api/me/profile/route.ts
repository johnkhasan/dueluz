import { handler, ok, parseJson } from '@/lib/api';
import { assertSameOrigin } from '@/lib/request';
import { updateProfileSchema } from '@/lib/validation';
import { requireUser } from '@/server/auth/guards';
import { updateProfile } from '@/server/auth/service';

export const PATCH = handler(async (request) => {
  assertSameOrigin(request);
  const user = await requireUser();
  const input = await parseJson(request, updateProfileSchema);
  return ok({ user: await updateProfile(user.id, input) });
});
