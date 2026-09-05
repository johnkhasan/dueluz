'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { useI18n } from '@/components/providers/i18n-provider';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiDelete, apiPatch, apiPost } from '@/lib/client/api';
import { categorySchema } from '@/lib/validation';

export type AdminCategory = {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  emoji: string;
  color: string;
  position: number;
  isActive: boolean;
  duelCount: number;
};

const EMPTY = {
  slug: '',
  nameUz: '',
  nameRu: '',
  nameEn: '',
  emoji: '✨',
  color: '#6366f1',
  position: 0,
  isActive: true,
};

export function CategoryManager({
  categories,
  canEdit,
}: {
  categories: AdminCategory[];
  canEdit: boolean;
}) {
  const { t, errorMessage } = useI18n();
  const { show } = useToast();
  const router = useRouter();

  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const parsed = categorySchema.safeParse(draft);
    if (!parsed.success) {
      const issues: Record<string, string> = {};
      for (const issue of parsed.error.issues) issues[issue.path.join('.')] ??= issue.message;
      setErrors(issues);
      return;
    }

    setCreating(true);
    setErrors({});
    try {
      await apiPost('/api/admin/categories', parsed.data);
      setDraft(EMPTY);
      show(t.common.save, 'success');
      router.refresh();
    } catch (error) {
      show(
        error instanceof ApiClientError ? errorMessage(error.code, error.message) : errorMessage(undefined),
        'error',
      );
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(category: AdminCategory) {
    try {
      await apiPatch(`/api/admin/categories/${category.id}`, { isActive: !category.isActive });
      router.refresh();
    } catch {
      show(errorMessage(undefined), 'error');
    }
  }

  async function remove(category: AdminCategory) {
    if (!window.confirm(t.admin.confirmDelete)) return;
    try {
      await apiDelete(`/api/admin/categories/${category.id}`);
      router.refresh();
    } catch (error) {
      show(
        error instanceof ApiClientError ? errorMessage(error.code, error.message) : errorMessage(undefined),
        'error',
      );
    }
  }

  return (
    <div className="space-y-5">
      <ul className="space-y-2">
        {categories.map((category) => (
          <li
            key={category.id}
            className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-xl border p-3.5"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
              style={{ backgroundColor: `${category.color}20` }}
              aria-hidden
            >
              {category.emoji}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-fg truncate font-semibold">
                {category.nameUz} · {category.nameRu} · {category.nameEn}
              </p>
              <p className="text-fg-subtle text-xs">
                /{category.slug} · {category.duelCount} {t.admin.duels}
              </p>
            </div>

            <Badge tone={category.isActive ? 'success' : 'neutral'}>
              {category.isActive ? t.admin.active : '—'}
            </Badge>

            {canEdit ? (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => void toggleActive(category)}>
                  {category.isActive ? t.admin.hide : t.admin.restore}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(category)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {canEdit ? (
        <Card>
          <CardBody>
            <form onSubmit={create} className="space-y-4">
              <CardTitle>{t.admin.newCategory}</CardTitle>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="slug"
                  value={draft.slug}
                  error={errors.slug}
                  onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                />
                <Input
                  label={t.admin.emoji}
                  value={draft.emoji}
                  error={errors.emoji}
                  onChange={(event) => setDraft({ ...draft, emoji: event.target.value })}
                />
                <Input
                  label="O'zbekcha"
                  value={draft.nameUz}
                  error={errors.nameUz}
                  onChange={(event) => setDraft({ ...draft, nameUz: event.target.value })}
                />
                <Input
                  label="Русский"
                  value={draft.nameRu}
                  error={errors.nameRu}
                  onChange={(event) => setDraft({ ...draft, nameRu: event.target.value })}
                />
                <Input
                  label="English"
                  value={draft.nameEn}
                  error={errors.nameEn}
                  onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })}
                />
                <Input
                  label={t.admin.color}
                  type="color"
                  value={draft.color}
                  error={errors.color}
                  onChange={(event) => setDraft({ ...draft, color: event.target.value })}
                />
              </div>

              <Button type="submit" loading={creating}>
                <Plus className="size-4" />
                {t.common.save}
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
