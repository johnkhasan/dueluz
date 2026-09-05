import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import type { BrowserContext } from '@playwright/test';

// The dev server under test reads the repo-root .env; the runner needs the same
// DATABASE_URL to reach into the database it is using.
config({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)) });

/**
 * Puts a signed-in session in the browser jar.
 *
 * Sign-in itself cannot be driven from here: it goes through Telegram's own
 * iframe and needs a real Telegram account, so no browser automation can
 * complete it. The session is therefore minted the way the server would — a
 * random token whose SHA-256 is the stored row — which exercises everything
 * downstream of the login screen while leaving the login screen itself to the
 * unit tests over `verifyWidgetLogin`/`verifyInitData`.
 */
export async function signInAsNewUser(context: BrowserContext, baseURL: string) {
  const { prisma } = await import('@dueluz/db');

  const stamp = Date.now().toString().slice(-9);
  const user = await prisma.user.create({
    data: {
      telegramId: `e2e-${stamp}`,
      telegramUsername: `e2e${stamp}`,
      username: `e2e${stamp}`,
      displayName: 'E2E Tester',
    },
  });

  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  await context.addCookies([{ name: 'duel_session', value: token, url: baseURL }]);
  return user;
}
