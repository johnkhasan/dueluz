import { isUniqueViolation, prisma } from '@dueluz/db';
import { AppError } from '@/lib/errors';
import type { UpdateProfileInput } from '@/lib/validation';
import { cleanLine } from '@/lib/sanitize';
import { slugSuffix, usernameFromTelegram } from '@/lib/slug';
import { deleteUpload, mirrorRemoteImage } from '../uploads/service';
import type { TelegramProfile } from './telegram';
import { createSession, type SessionUser } from './session';

type RequestMeta = { userAgent?: string | null; ipHash?: string | null };

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  telegramUsername: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  locale: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

/**
 * Signs in the holder of a verified Telegram identity, creating the account on
 * first contact.
 *
 * There is no separate registration step: the identity is already proven by the
 * time this runs, so asking for a second screen of details would only add a
 * place to drop out. Everything the profile needs is derived from Telegram and
 * stays editable in settings afterwards.
 *
 * `profile` must come from `verifyWidgetLogin`/`verifyInitData` — nothing here
 * re-checks the signature.
 */
export async function loginWithTelegram(
  profile: TelegramProfile,
  meta: RequestMeta,
): Promise<{ user: SessionUser; created: boolean }> {
  const existing = await prisma.user.findUnique({
    where: { telegramId: profile.telegramId },
    select: { ...PUBLIC_USER_SELECT, bannedUntil: true, avatarKey: true },
  });

  const user = existing
    ? await refreshFromTelegram(existing, profile)
    : await createFromTelegram(profile);

  await createSession(user.id, meta);
  return { user, created: existing === null };
}

/** A ban has to be enforced here too — sign-in is how a banned user comes back. */
function assertNotBanned(user: { status: string; bannedUntil: Date | null }): void {
  if (user.status === 'BANNED' && (!user.bannedUntil || user.bannedUntil > new Date())) {
    throw new AppError('ACCOUNT_BANNED', 'This account has been suspended');
  }
}

type ExistingUser = SessionUser & { bannedUntil: Date | null; avatarKey: string | null };

/**
 * Folds changes made on Telegram's side back into the account.
 *
 * A handle can be changed or dropped at any time, so it is mirrored on every
 * sign-in. The avatar is not: once someone has uploaded their own picture
 * (`avatarKey` is set) their choice outranks whatever Telegram reports.
 */
/**
 * Copies a Telegram profile picture into our own storage.
 *
 * Telegram's `photo_url` is a t.me CDN path that expires: an avatar that loads
 * today returns 404 later, leaving a broken image on every page the user
 * appears on. Serving our own copy also stops each visitor's browser from
 * announcing to Telegram which profiles they are looking at.
 *
 * Never throws — a missing avatar is cosmetic, and sign-in must not depend on
 * a third party being reachable.
 */
async function mirrorTelegramPhoto(photoUrl: string, ownerId: string) {
  try {
    return await mirrorRemoteImage(photoUrl, 'avatar', ownerId);
  } catch (error) {
    console.warn('[auth] could not mirror the Telegram avatar', error);
    return null;
  }
}

async function refreshFromTelegram(
  existing: ExistingUser,
  profile: TelegramProfile,
): Promise<SessionUser> {
  assertNotBanned(existing);

  const changes: {
    telegramUsername?: string | null;
    avatarUrl?: string | null;
    avatarKey?: string | null;
  } = {};
  if (existing.telegramUsername !== profile.username) {
    changes.telegramUsername = profile.username;
  }

  // Only mirror when the account has no stored avatar yet: a picture the user
  // uploaded here, or one already mirrored, must not be overwritten on every
  // sign-in.
  if (!existing.avatarKey && profile.photoUrl) {
    const mirrored = await mirrorTelegramPhoto(profile.photoUrl, existing.id);
    if (mirrored) {
      changes.avatarUrl = mirrored.url;
      changes.avatarKey = mirrored.key;
    } else if (existing.avatarUrl) {
      // The photo is gone from Telegram's CDN, so the stored URL is a dead
      // link. Clearing it lets the initials avatar take over.
      changes.avatarUrl = null;
    }
  }

  const { bannedUntil: _banned, avatarKey: _key, ...user } = existing;
  void _banned;
  void _key;

  if (Object.keys(changes).length === 0) return user;

  return prisma.user.update({
    where: { id: existing.id },
    data: changes,
    select: PUBLIC_USER_SELECT,
  });
}

/**
 * First sign-in. The Telegram handle is the preferred username, but it lives in
 * a namespace we do not control, so a taken one falls back to a suffixed
 * variant. The unique constraint — not the availability check — is what
 * actually decides, which keeps two simultaneous first logins race-free.
 */
async function createFromTelegram(profile: TelegramProfile): Promise<SessionUser> {
  const base = usernameFromTelegram(profile.username, profile.firstName);
  const displayName =
    cleanLine([profile.firstName, profile.lastName].filter(Boolean).join(' ')).slice(0, 40) ||
    base;

  // Mirrored under the Telegram id: the account row does not exist yet, and the
  // id is stable, unguessable and already unique.
  const avatar = profile.photoUrl
    ? await mirrorTelegramPhoto(profile.photoUrl, profile.telegramId)
    : null;

  const data = {
    telegramId: profile.telegramId,
    telegramUsername: profile.username,
    displayName,
    avatarUrl: avatar?.url ?? null,
    avatarKey: avatar?.key ?? null,
    locale: profile.locale ?? 'uz',
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const username = attempt === 0 ? base : `${base.slice(0, 13)}_${slugSuffix(attempt + 2)}`;
    try {
      return await prisma.user.create({
        data: { ...data, username },
        select: PUBLIC_USER_SELECT,
      });
    } catch (error) {
      // Two tabs finishing the same first login: the loser reads the winner's row.
      // Matched loosely because Prisma reports the clashing constraint by field
      // name, column name or index name depending on the adapter.
      if (isUniqueViolation(error, 'telegram')) {
        const raced = await prisma.user.findUnique({
          where: { telegramId: profile.telegramId },
          select: PUBLIC_USER_SELECT,
        });
        if (raced) return raced;
      }
      if (!isUniqueViolation(error, 'username')) throw error;
    }
  }

  throw new AppError('USERNAME_TAKEN', 'Could not allocate a username. Please try again.');
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<SessionUser> {
  // A new avatar orphans the old file in object storage unless it is removed.
  if (input.avatarKey !== undefined) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true },
    });
    if (existing?.avatarKey && existing.avatarKey !== input.avatarKey) {
      await deleteUpload(existing.avatarKey);
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.displayName !== undefined ? { displayName: cleanLine(input.displayName) } : {}),
      ...(input.bio !== undefined ? { bio: input.bio ? cleanLine(input.bio) : null } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.avatarKey !== undefined ? { avatarKey: input.avatarKey } : {}),
    },
    select: PUBLIC_USER_SELECT,
  });
}

/** Public profile plus the aggregate stats shown on /u/[username]. */
export async function getPublicProfile(username: string) {
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      status: true,
      role: true,
      createdAt: true,
    },
  });
  if (!user) throw new AppError('NOT_FOUND', 'User not found');

  const [duelCount, voteCount, likesReceived] = await Promise.all([
    prisma.duel.count({ where: { authorId: user.id, status: 'PUBLISHED' } }),
    prisma.vote.count({ where: { userId: user.id } }),
    prisma.duel.aggregate({
      where: { authorId: user.id, status: 'PUBLISHED' },
      _sum: { likeCount: true },
    }),
  ]);

  return {
    user,
    stats: {
      duels: duelCount,
      votes: voteCount,
      likesReceived: likesReceived._sum.likeCount ?? 0,
    },
  };
}
