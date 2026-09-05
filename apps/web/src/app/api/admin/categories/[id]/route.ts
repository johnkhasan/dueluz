import { handler, ok, parseJson } from '@/lib/api';
import { assertSameOrigin } from '@/lib/request';
import { categorySchema } from '@/lib/validation';
import { requireRole } from '@/server/auth/guards';
import { deleteCategory, updateCategory } from '@/server/admin/service';
import { cacheDelete } from '@/lib/redis';

type Params = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  await requireRole('ADMIN');
  const { id } = await params;
  const input = await parseJson(request, categorySchema.partial());

  const category = await updateCategory(id, input);
  await cacheDelete('categories:*');
  return ok({ category });
});

export const DELETE = handler(async (request, { params }: Params) => {
  assertSameOrigin(request);
  await requireRole('ADMIN');
  const { id } = await params;

  const result = await deleteCategory(id);
  await cacheDelete('categories:*');
  return ok(result);
});
