'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Plus, Swords, User } from 'lucide-react';
import { useI18n } from '@/components/providers/i18n-provider';
import { useSession } from '@/components/providers/session-provider';
import { cn } from '@/lib/utils';

/**
 * Mobile primary navigation. The create action sits in the middle as a raised
 * button because duel creation is the growth loop's second half.
 */
export function BottomNav() {
  const { locale, t } = useI18n();
  const user = useSession();
  const pathname = usePathname();
  const base = `/${locale}`;

  const items = [
    { href: base, label: t.nav.home, Icon: Swords, exact: true },
    { href: `${base}/explore`, label: t.nav.explore, Icon: Compass },
    { href: `${base}/create`, label: t.nav.create, Icon: Plus, primary: true },
    { href: `${base}/my`, label: t.nav.myDuels, Icon: Swords },
    {
      href: user ? `${base}/u/${user.username}` : `${base}/login`,
      label: user ? t.nav.profile : t.nav.login,
      Icon: User,
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="bg-bg/90 border-border fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-lg sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-end justify-around px-2 py-1.5">
        {items.map(({ href, label, Icon, exact, primary }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);

          if (primary) {
            return (
              <li key={href}>
                <Link
                  href={href}
                  className="brand-gradient shadow-card -mt-5 flex size-12 items-center justify-center rounded-2xl text-white"
                  aria-label={label}
                >
                  <Icon className="size-6" />
                </Link>
              </li>
            );
          }

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-semibold transition-colors',
                  active ? 'text-accent' : 'text-fg-subtle',
                )}
              >
                <Icon className="size-5" />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
