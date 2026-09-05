'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type ClientUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
};

const SessionContext = createContext<ClientUser | null>(null);

/**
 * The signed-in user, resolved on the server and handed to the client tree.
 * There is no client-side fetch for identity, so nothing renders in a
 * logged-out state and then flips.
 */
export function SessionProvider({
  user,
  children,
}: {
  user: ClientUser | null;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** Null when signed out. Never trusted for authorisation — the server re-checks. */
export function useSession(): ClientUser | null {
  return useContext(SessionContext);
}
