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

// Deterministic secrets: the tests assert on signing behaviour, not on entropy.
process.env.SESSION_SECRET ??= 'test-session-secret-at-least-32-chars-long';
process.env.ANON_SECRET ??= 'test-anon-secret-at-least-32-chars-long!!';
process.env.IP_SALT ??= 'test-ip-salt-value-at-least-32-chars-long';
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';

// Never let a test hit a shared Redis: the in-process limiter is per-run.
delete process.env.REDIS_URL;
