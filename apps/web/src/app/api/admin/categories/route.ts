import { created, handler, ok, parseJson } from '@/lib/api';
import { assertSameOrigin } from '@/lib/request';
import { categorySchema } from '@/lib/validation';
import { requireRole } from '@/server/auth/guards';
import { createCategory, listCategoriesAdmin } from '@/server/admin/service';
import { cacheDelete } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireRole('MODERATOR');
  return ok({ categories: await listCategoriesAdmin() });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  await requireRole('ADMIN');
  const input = await parseJson(request, categorySchema);

  const category = await createCategory(input);
  await cacheDelete('categories:*');
  return created({ category });
});
