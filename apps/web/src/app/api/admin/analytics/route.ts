import { z } from 'zod';
import { handler, ok, parseQuery } from '@/lib/api';
import { requireRole } from '@/server/auth/guards';
import { analyticsOverview } from '@/server/admin/service';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  await requireRole('MODERATOR');
  const { days } = parseQuery(request, z.object({ days: z.coerce.number().int().min(7).max(90).default(14) }));
  return ok(await analyticsOverview(days));
});
