import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, FileWarning, Folder, LayoutDashboard, MessageSquare, Swords, Users } from 'lucide-react';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionary';
import { currentUser } from '@/server/auth/guards';
import { hasRole } from '@/server/auth/guards';

export const dynamic = 'force-dynamic';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Server-side gate for the whole admin area. Every admin API route repeats the
 * check independently, so this layout is a UX guard, not the security boundary.
 */
export default async function AdminLayout({ children, params }: LayoutProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'uz';
  const t = getDictionary(locale);

  const user = await currentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  if (!hasRole(user, 'MODERATOR')) redirect(`/${locale}`);

  const base = `/${locale}/admin`;
  const links = [
    { href: base, label: t.admin.dashboard, Icon: LayoutDashboard },
    { href: `${base}/reports`, label: t.admin.reports, Icon: FileWarning },
    { href: `${base}/duels`, label: t.admin.duels, Icon: Swords },
    { href: `${base}/comments`, label: t.admin.comments, Icon: MessageSquare },
    { href: `${base}/users`, label: t.admin.users, Icon: Users },
    { href: `${base}/categories`, label: t.admin.categories, Icon: Folder },
    { href: `${base}/analytics`, label: t.admin.analytics, Icon: BarChart3 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-fg text-2xl font-black tracking-tight">{t.admin.title}</h1>
        <span className="text-fg-subtle text-xs font-semibold">
          {user.displayName} · {user.role}
        </span>
      </div>

      <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4">
        {links.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="border-border bg-surface text-fg-muted hover:bg-surface-muted hover:text-fg inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors"
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
