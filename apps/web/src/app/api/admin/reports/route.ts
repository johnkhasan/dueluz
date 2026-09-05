import { z } from 'zod';
import { handler, ok, parseQuery } from '@/lib/api';
import { requireRole } from '@/server/auth/guards';
import { listReports } from '@/server/admin/service';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  await requireRole('MODERATOR');
  const query = parseQuery(
    request,
    z.object({
      status: z.enum(['PENDING', 'RESOLVED', 'DISMISSED']).default('PENDING'),
      cursor: z.string().max(200).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(25),
    }),
  );

  const { items, nextCursor } = await listReports(query);
  return ok({ reports: items }, { nextCursor });
});
