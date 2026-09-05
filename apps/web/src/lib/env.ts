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
  /** Absolute, or relative to the server's working directory. */
  LOCAL_STORAGE_DIR: z.string().default('./public/uploads'),
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

  // Sign-in is Telegram-only. Optional here so `pnpm test` and a first
  // `pnpm dev` boot before a bot exists; production is checked below and the
  // login endpoint refuses to run without a token.
  TELEGRAM_BOT_TOKEN: z.string().optional().or(z.literal('')),
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value?.replace(/^@/, '') ?? ''),
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

  // Nobody can sign in without these, so a production deploy that is missing
  // them is a real misconfiguration — but not a fatal one. Throwing here would
  // take down browsing and anonymous voting too, which work perfectly well
  // without a bot; the site would 500 on every request because sign-in is
  // unconfigured. Sign-in itself still fails closed: the login page says it is
  // not configured and `/api/auth/telegram` refuses to run.
  //
  // Skipped during `next build`, which also runs as NODE_ENV=production and has
  // no business holding the bot token.
  const building = process.env.NEXT_PHASE === 'phase-production-build';
  if (value.NODE_ENV === 'production' && !building) {
    const missing = (['TELEGRAM_BOT_TOKEN', 'NEXT_PUBLIC_TELEGRAM_BOT_USERNAME'] as const).filter(
      (key) => !value[key],
    );
    if (missing.length > 0) {
      console.error(
        `[env] Telegram sign-in is DISABLED - missing: ${missing.join(', ')}. ` +
          'Nobody can log in until these are set.',
      );
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

/** Bot username the Login Widget is rendered for. Empty until a bot is set up. */
export const TELEGRAM_BOT_USERNAME = env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
