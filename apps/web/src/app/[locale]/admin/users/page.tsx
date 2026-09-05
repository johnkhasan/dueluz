import Link from 'next/link';
import { ActionButton } from '@/components/admin/action-button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { formatDate } from '@/lib/utils';
import { listUsers } from '@/server/admin/service';
import { currentUser } from '@/server/auth/guards';

export const dynamic = 'force-dynamic';

export default async function AdminUsers({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const t = getDictionary(locale);
  const { q } = await searchParams;

  const [{ items }, actor] = await Promise.all([listUsers({ q, limit: 50 }), currentUser()]);
  const isAdmin = actor?.role === 'ADMIN';

  return (
    <div className="space-y-4">
      <form action={`/${locale}/admin/users`} className="max-w-sm">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t.admin.searchUsers}
          className="border-border bg-surface focus:border-ring focus:ring-ring/25 w-full rounded-xl border px-3.5 py-2.5 outline-none focus:ring-2"
        />
      </form>

      {items.length === 0 ? (
        <EmptyState title={t.admin.noItems} />
      ) : (
        <ul className="space-y-2">
          {items.map((user) => (
            <li
              key={user.id}
              className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-xl border p-3.5"
            >
              <Avatar name={user.displayName} src={user.avatarUrl} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/${locale}/u/${user.username}`}
                    className="text-fg hover:text-accent truncate font-semibold transition-colors"
                  >
                    {user.displayName}
                  </Link>
                  {user.role !== 'USER' ? <Badge tone="a">{user.role}</Badge> : null}
                  {user.status === 'BANNED' ? <Badge tone="danger">BANNED</Badge> : null}
                </div>
                <p className="text-fg-subtle truncate text-xs">
                  @{user.username} · {user.email} · {formatDate(user.createdAt, locale)}
                </p>
                <p className="text-fg-muted text-xs font-semibold">
                  {user._count.duels} {t.admin.duels} · {user._count.votes} {t.duel.votes} ·{' '}
                  {user._count.comments} {t.admin.comments}
                </p>
              </div>

              {user.role !== 'ADMIN' ? (
                <div className="flex flex-wrap gap-2">
                  {user.status === 'BANNED' ? (
                    <ActionButton
                      endpoint={`/api/admin/users/${user.id}`}
                      body={{ action: 'UNBAN' }}
                    >
                      {t.admin.unban}
                    </ActionButton>
                  ) : (
                    <ActionButton
                      endpoint={`/api/admin/users/${user.id}`}
                      body={{ action: 'BAN' }}
                      confirm={t.admin.confirmBan}
                      variant="danger"
                    >
                      {t.admin.ban}
                    </ActionButton>
                  )}

                  {isAdmin ? (
                    user.role === 'MODERATOR' ? (
                      <ActionButton
                        endpoint={`/api/admin/users/${user.id}`}
                        body={{ action: 'DEMOTE' }}
                        variant="ghost"
                      >
                        USER
                      </ActionButton>
                    ) : (
                      <ActionButton
                        endpoint={`/api/admin/users/${user.id}`}
                        body={{ action: 'PROMOTE' }}
                        variant="ghost"
                      >
                        MODERATOR
                      </ActionButton>
                    )
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
