import { isUniqueViolation, prisma } from '@dueluz/db';
import { AppError } from '@/lib/errors';
import type { LoginInput, RegisterInput, UpdateProfileInput } from '@/lib/validation';
import { cleanLine } from '@/lib/sanitize';
import { randomToken } from '@/lib/crypto';
import { deleteUpload } from '../uploads/service';
import { assertStrongPassword, hashPassword, verifyPassword } from './password';
import { createSession, destroyAllSessions, type SessionUser } from './session';

type RequestMeta = { userAgent?: string | null; ipHash?: string | null };

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  locale: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

export async function register(input: RegisterInput, meta: RequestMeta): Promise<SessionUser> {
  assertStrongPassword(input.password);

  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        displayName: cleanLine(input.displayName),
        passwordHash,
        locale: input.locale ?? 'uz',
      },
      select: PUBLIC_USER_SELECT,
    });
  } catch (error) {
    if (isUniqueViolation(error, 'email')) throw new AppError('EMAIL_TAKEN');
    if (isUniqueViolation(error, 'username')) throw new AppError('USERNAME_TAKEN');
    throw error;
  }

  await createSession(user.id, meta);
  return user;
}

export async function login(input: LoginInput, meta: RequestMeta): Promise<SessionUser> {
  const record = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: 'insensitive' } },
    select: { ...PUBLIC_USER_SELECT, passwordHash: true, bannedUntil: true },
  });

  // Always run a verification so a missing account and a wrong password take
  // comparable time and cannot be told apart by timing.
  const digest = record?.passwordHash ?? (await placeholderDigest());
  const valid = await verifyPassword(digest, input.password);

  if (!record || !valid) {
    throw new AppError('INVALID_CREDENTIALS', 'Wrong email or password');
  }

  if (record.status === 'BANNED' && (!record.bannedUntil || record.bannedUntil > new Date())) {
    throw new AppError('ACCOUNT_BANNED', 'This account has been suspended');
  }

  const { passwordHash: _ignored, bannedUntil: _also, ...user } = record;
  void _ignored;
  void _also;

  await createSession(user.id, meta);
  return user;
}

/**
 * A genuine argon2 digest of a random string, computed once per process.
 * Verifying against it costs exactly what verifying a real password costs,
 * which is what keeps login timing flat for unknown emails.
 */
let placeholder: string | null = null;
async function placeholderDigest(): Promise<string> {
  placeholder ??= await hashPassword(randomToken());
  return placeholder;
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

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  assertStrongPassword(newPassword);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new AppError('NOT_FOUND', 'User not found');

  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new AppError('INVALID_CREDENTIALS', 'Current password is incorrect');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  // Changing a password invalidates every other device.
  await destroyAllSessions(userId);
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
