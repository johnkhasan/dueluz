import { z } from 'zod';

/**
 * Server-side environment. Parsed once, at boot, so a misconfigured deploy
 * fails loudly instead of silently disabling security features.
 *
 * Never import this from a client component.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional().or(z.literal('')),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  ANON_SECRET: z.string().min(32, 'ANON_SECRET must be at least 32 characters'),
  IP_SALT: z.string().min(32, 'IP_SALT must be at least 32 characters'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./apps/web/public/uploads'),
  LOCAL_STORAGE_PUBLIC_PATH: z.string().default('/uploads'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),

  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Duel.uz'),
});

function parseEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\n` +
        'Run `node scripts/setup-env.mjs` to generate a valid .env file.',
    );
  }

  const value = parsed.data;
  if (value.STORAGE_DRIVER === 's3') {
    const missing = (['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const).filter(
      (key) => !value[key],
    );
    if (missing.length > 0) {
      throw new Error(`STORAGE_DRIVER=s3 requires: ${missing.join(', ')}`);
    }
  }
  return value;
}

export const env = parseEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

/** Canonical origin without a trailing slash. */
export const APP_URL = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
export const APP_NAME = env.NEXT_PUBLIC_APP_NAME;

/**
 * Whether cookies may carry the `Secure` flag.
 *
 * Derived from the real origin rather than from NODE_ENV: a `Secure` cookie is
 * silently dropped by the browser over plain http, which would break anonymous
 * voting and sign-in on an http staging box with no visible error. Deriving it
 * from the origin means TLS-terminating proxies still get secure cookies (the
 * app's public URL is https) while an http deployment stays functional.
 */
export const useSecureCookies = APP_URL.startsWith('https://');
