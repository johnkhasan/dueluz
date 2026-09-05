import { handler, ok } from '@/lib/api';
import { assertSameOrigin } from '@/lib/request';
import { destroySession } from '@/server/auth/session';

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  await destroySession();
  return ok({ loggedOut: true });
});
