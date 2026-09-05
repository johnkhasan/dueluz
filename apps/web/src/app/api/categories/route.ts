import { handler, ok, parseQuery } from '@/lib/api';
import { z } from 'zod';
import { listCategories } from '@/server/categories/service';

export const GET = handler(async (request) => {
  const { locale } = parseQuery(
    request,
    z.object({ locale: z.enum(['uz', 'ru', 'en']).default('uz') }),
  );
  return ok({ categories: await listCategories(locale) });
});
