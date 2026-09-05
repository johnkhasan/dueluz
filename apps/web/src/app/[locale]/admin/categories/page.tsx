import { CategoryManager } from '@/components/admin/category-manager';
import { listCategoriesAdmin } from '@/server/admin/service';
import { currentUser } from '@/server/auth/guards';

export const dynamic = 'force-dynamic';

export default async function AdminCategories() {
  const [categories, actor] = await Promise.all([listCategoriesAdmin(), currentUser()]);

  return (
    <CategoryManager
      categories={categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        nameUz: category.nameUz,
        nameRu: category.nameRu,
        nameEn: category.nameEn,
        emoji: category.emoji,
        color: category.color,
        position: category.position,
        isActive: category.isActive,
        duelCount: category.duelCount,
      }))}
      canEdit={actor?.role === 'ADMIN'}
    />
  );
}
