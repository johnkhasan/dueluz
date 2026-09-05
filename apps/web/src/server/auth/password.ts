import { hash, verify } from '@node-rs/argon2';
import { AppError } from '@/lib/errors';

/**
 * argon2id with OWASP-recommended parameters. Chosen over bcrypt because it is
 * memory-hard, which makes GPU cracking of a leaked table far more expensive.
 */
const OPTIONS = {
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(digest: string, plain: string): Promise<boolean> {
  try {
    return await verify(digest, plain, OPTIONS);
  } catch {
    return false;
  }
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', '12345678', '123456789', 'qwerty123', 'qwertyui',
  'iloveyou', 'admin123', 'welcome1', 'letmein1', 'parol123', 'password123',
]);

/**
 * Password policy. Length carries most of the strength; the character-class
 * rule only rules out the trivially weak cases.
 */
export function assertStrongPassword(plain: string): void {
  if (plain.length < 8) {
    throw new AppError('WEAK_PASSWORD', 'Password must be at least 8 characters');
  }
  if (plain.length > 128) {
    throw new AppError('WEAK_PASSWORD', 'Password must be at most 128 characters');
  }
  if (!/[a-zA-Z]/.test(plain) || !/[0-9]/.test(plain)) {
    throw new AppError('WEAK_PASSWORD', 'Password must contain both letters and numbers');
  }
  if (COMMON_PASSWORDS.has(plain.toLowerCase())) {
    throw new AppError('WEAK_PASSWORD', 'This password is too common');
  }
}
