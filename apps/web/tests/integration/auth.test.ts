import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@dueluz/db';
import { AppError } from '@/lib/errors';
import { loginWithTelegram } from '@/server/auth/service';
import type { TelegramProfile } from '@/server/auth/telegram';
import { resetDatabase } from './helpers';

/**
 * `createSession` writes a cookie, which needs a request scope these tests do
 * not have. Everything under test happens before that, so the cookie write is
 * stubbed out and the session row is asserted on directly.
 */
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));

function profile(over: Partial<TelegramProfile> = {}): TelegramProfile {
  return {
    telegramId: '100200300',
    firstName: 'Javohir',
    lastName: 'Hasanov',
    username: 'javohir',
    photoUrl: 'https://t.me/i/userpic/320/javohir.jpg',
    locale: 'uz',
    ...over,
  };
}

/** A real 2x2 PNG: the mirror runs the bytes through sharp, so they must decode. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYEJRIAAHRUCJlOJ2AsAAAAASUVORK5CYII=',
  'base64',
);

/** Makes the avatar mirror succeed (an image) or fail (a dead link). */
function stubTelegramCdn({ ok }: { ok: boolean }) {
  vi.stubGlobal('fetch', async () =>
    ok
      ? new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } })
      : new Response('not found', { status: 404 }),
  );
}

afterEach(() => vi.unstubAllGlobals());

beforeAll(resetDatabase);
beforeEach(resetDatabase);

describe('telegram sign-in', () => {
  it('creates the account on first contact and reuses it afterwards', async () => {
    stubTelegramCdn({ ok: true });
    const first = await loginWithTelegram(profile(), {});
    expect(first.created).toBe(true);
    expect(first.user.username).toBe('javohir');
    expect(first.user.displayName).toBe('Javohir Hasanov');

    const second = await loginWithTelegram(profile(), {});
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);

    expect(await prisma.user.count()).toBe(1);
    // Each sign-in is its own revocable session.
    expect(await prisma.session.count({ where: { userId: first.user.id } })).toBe(2);
  });

  it('gives the second holder of a taken handle a distinct username', async () => {
    const first = await loginWithTelegram(profile(), {});
    const second = await loginWithTelegram(
      profile({ telegramId: '999', username: 'javohir', firstName: 'Boshqa' }),
      {},
    );

    expect(second.created).toBe(true);
    expect(second.user.id).not.toBe(first.user.id);
    expect(second.user.username).not.toBe(first.user.username);
    expect(second.user.username).toMatch(/^javohir/);
  });

  it('mirrors a renamed Telegram handle onto the account', async () => {
    const { user } = await loginWithTelegram(profile(), {});
    await loginWithTelegram(profile({ username: 'javohir_new' }), {});

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.telegramUsername).toBe('javohir_new');
    // The username people link to is theirs, not Telegram's, so it stays put.
    expect(stored.username).toBe('javohir');
  });

  it('mirrors the Telegram photo instead of storing the t.me link', async () => {
    stubTelegramCdn({ ok: true });
    const { user } = await loginWithTelegram(profile(), {});

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    // Telegram's photo_url expires, so the link must never reach the database.
    expect(stored.avatarUrl).not.toContain('t.me');
    expect(stored.avatarUrl).toMatch(/^\/uploads\/avatar\//);
    expect(stored.avatarKey).toBeTruthy();
  });

  it('falls back to no avatar when the photo is already gone from Telegram', async () => {
    stubTelegramCdn({ ok: false });
    const { user } = await loginWithTelegram(profile(), {});

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    // Null, not a dead link: the UI renders its initials avatar instead of a
    // broken image.
    expect(stored.avatarUrl).toBeNull();
    expect(stored.avatarKey).toBeNull();
  });

  it('signs the user in even when Telegram is unreachable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('network down');
    });
    const { user, created } = await loginWithTelegram(profile(), {});
    expect(created).toBe(true);
    expect(user.id).toBeTruthy();
  });

  it('never overwrites an avatar the account already has', async () => {
    stubTelegramCdn({ ok: true });
    const { user } = await loginWithTelegram(profile(), {});
    const mirrored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    // A second sign-in must not re-fetch and replace it.
    await loginWithTelegram(profile({ photoUrl: 'https://t.me/i/userpic/320/newer.jpg' }), {});
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).avatarUrl).toBe(
      mirrored.avatarUrl,
    );

    // Neither must it replace one the user uploaded here.
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: '/uploads/avatar/mine.webp', avatarKey: 'avatar/mine.webp' },
    });
    await loginWithTelegram(profile({ photoUrl: 'https://t.me/i/userpic/320/newest.jpg' }), {});
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).avatarUrl).toBe(
      '/uploads/avatar/mine.webp',
    );
  });

  it('refuses to sign a banned account back in', async () => {
    const { user } = await loginWithTelegram(profile(), {});
    await prisma.user.update({ where: { id: user.id }, data: { status: 'BANNED' } });

    await expect(loginWithTelegram(profile(), {})).rejects.toThrow(AppError);
  });

  it('lets a user back in once a temporary ban has expired', async () => {
    const { user } = await loginWithTelegram(profile(), {});
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'BANNED', bannedUntil: new Date(Date.now() - 1000) },
    });

    await expect(loginWithTelegram(profile(), {})).resolves.toMatchObject({ created: false });
  });
});
