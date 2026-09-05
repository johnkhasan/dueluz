import { z } from 'zod';
import { handler, ok, parseQuery } from '@/lib/api';
import { requireRole } from '@/server/auth/guards';
import { listDuelsAdmin } from '@/server/admin/service';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  await requireRole('MODERATOR');
  const query = parseQuery(
    request,
    z.object({
      status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN', 'DELETED']).optional(),
      q: z.string().max(60).optional(),
      cursor: z.string().max(200).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(25),
    }),
  );

  const { items, nextCursor } = await listDuelsAdmin(query);
  return ok({ duels: items }, { nextCursor });
});
