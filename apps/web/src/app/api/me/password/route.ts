import { handler, ok, parseJson } from '@/lib/api';
import { assertSameOrigin } from '@/lib/request';
import { changePasswordSchema } from '@/lib/validation';
import { requireUser } from '@/server/auth/guards';
import { changePassword } from '@/server/auth/service';

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const user = await requireUser();
  const input = await parseJson(request, changePasswordSchema);

  // Every session, including this one, is revoked on success.
  await changePassword(user.id, input.currentPassword, input.newPassword);
  return ok({ changed: true });
});
