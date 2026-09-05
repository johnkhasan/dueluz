'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Compass, LayoutDashboard, LogOut, Plus, Settings, Swords, User } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/providers/i18n-provider';
import { useSession } from '@/components/providers/session-provider';
import { apiPost } from '@/lib/client/api';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';

export function TopNav() {
  const { locale, t } = useI18n();
  const user = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const base = `/${locale}`;
  const links = [
    { href: base, label: t.nav.home, Icon: Swords },
    { href: `${base}/explore`, label: t.nav.explore, Icon: Compass },
  ];

  async function logout() {
    await apiPost('/api/auth/logout').catch(() => undefined);
    setMenuOpen(false);
    // Same reasoning as sign-in: a hard load drops every cached RSC payload
    // that still reflects the signed-in state.
    window.location.assign(base);
  }

  return (
    <header className="bg-bg/85 border-border sticky top-0 z-40 border-b backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href={base} aria-label="Duel.uz">
          <Logo />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 sm:flex">
          {links.map(({ href, label, Icon }) => {
            const active = href === base ? pathname === base : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                  active ? 'bg-surface-muted text-fg' : 'text-fg-muted hover:text-fg',
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <ThemeToggle />

          <Link href={`${base}/create`} className="hidden sm:block">
            <Button size="sm">
              <Plus className="size-4" />
              {t.nav.create}
            </Button>
          </Link>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <Avatar name={user.displayName} src={user.avatarUrl} />
              </button>

              {menuOpen ? (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden
                  />
                  <div
                    role="menu"
                    className="bg-surface border-border shadow-pop animate-pop absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border py-1"
                  >
                    <div className="border-border border-b px-3 py-2.5">
                      <p className="truncate text-sm font-semibold">{user.displayName}</p>
                      <p className="text-fg-subtle truncate text-xs">@{user.username}</p>
                    </div>

                    <MenuLink href={`${base}/u/${user.username}`} Icon={User} onNavigate={() => setMenuOpen(false)}>
                      {t.nav.profile}
                    </MenuLink>
                    <MenuLink href={`${base}/my`} Icon={Swords} onNavigate={() => setMenuOpen(false)}>
                      {t.nav.myDuels}
                    </MenuLink>
                    <MenuLink href={`${base}/settings`} Icon={Settings} onNavigate={() => setMenuOpen(false)}>
                      {t.nav.settings}
                    </MenuLink>
                    {user.role !== 'USER' ? (
                      <MenuLink href={`${base}/admin`} Icon={LayoutDashboard} onNavigate={() => setMenuOpen(false)}>
                        {t.nav.admin}
                      </MenuLink>
                    ) : null}

                    <button
                      type="button"
                      onClick={logout}
                      role="menuitem"
                      className="text-danger hover:bg-surface-muted flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
                    >
                      <LogOut className="size-4" />
                      {t.nav.logout}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <Link href={`${base}/login`}>
              <Button size="sm" variant="secondary">
                {t.nav.login}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  href,
  Icon,
  children,
  onNavigate,
}: {
  href: string;
  Icon: typeof User;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="text-fg hover:bg-surface-muted flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
    >
      <Icon className="text-fg-subtle size-4" />
      {children}
    </Link>
  );
}
