import type { Role } from '@dueluz/db';
import { AppError } from '@/lib/errors';
import { getSessionUser, type SessionUser } from './session';

export type { SessionUser };

/** Current user or null. Use in pages that render differently when signed in. */
export const currentUser = getSessionUser;

/** Current user, or throws UNAUTHORIZED. Use in every authenticated mutation. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AppError('UNAUTHORIZED', 'You must be logged in');
  return user;
}

const RANK: Record<Role, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };

/** Roles are hierarchical: an ADMIN satisfies a MODERATOR requirement. */
export function hasRole(user: Pick<SessionUser, 'role'>, minimum: Role): boolean {
  return RANK[user.role] >= RANK[minimum];
}

export async function requireRole(minimum: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user, minimum)) {
    throw new AppError('FORBIDDEN', 'Insufficient permissions');
  }
  return user;
}

/** Owner-or-moderator check, used by delete/edit endpoints. */
export function assertCanModify(
  user: SessionUser,
  ownerId: string | null | undefined,
): void {
  if (ownerId && ownerId === user.id) return;
  if (hasRole(user, 'MODERATOR')) return;
  throw new AppError('FORBIDDEN', 'You can only modify your own content');
}
