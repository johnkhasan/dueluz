import { config } from 'dotenv';
import { resolve } from 'node:path';

// One .env at the repo root feeds the app, Prisma and the test runners.
config({ path: resolve(__dirname, '../../../.env') });

// NODE_ENV is typed read-only, but the runner genuinely needs it set here.
(process.env as Record<string, string | undefined>).NODE_ENV ??= 'test';

// Integration tests run against their own database so a failed run can never
// wipe development data.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Every signing key is FORCED to a fixed test value, overriding whatever the
// developer's .env holds.
//
// These are HMAC keys, and the test fixtures sign payloads with the same
// constants. Inheriting a real key made the suite pass or fail depending on
// whose machine it ran on: filling in a genuine TELEGRAM_BOT_TOKEN broke the
// signature tests, because the fixture still signed with the test token.
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long';
process.env.ANON_SECRET = 'test-anon-secret-at-least-32-chars-long!!';
process.env.IP_SALT = 'test-ip-salt-value-at-least-32-chars-long';
process.env.TELEGRAM_BOT_TOKEN = '1234567:test-bot-token-for-unit-tests';
process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = 'dueluz_test_bot';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Uploads must never leave the repo's dev directory during a test run.
process.env.STORAGE_DRIVER = 'local';

// Never let a test hit a shared Redis: the in-process limiter is per-run.
delete process.env.REDIS_URL;
