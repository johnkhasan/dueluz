import { handler, ok } from '@/lib/api';
import { requireRole } from '@/server/auth/guards';
import { dashboardStats } from '@/server/admin/service';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireRole('MODERATOR');
  return ok(await dashboardStats());
});
