import { handler, ok } from '@/lib/api';
import { currentUser } from '@/server/auth/guards';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const user = await currentUser();
  return ok({ user });
});
