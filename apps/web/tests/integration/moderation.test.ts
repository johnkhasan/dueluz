import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@dueluz/db';
import { moderateComment, moderateDuel, moderateUser, resolveReport } from '@/server/admin/service';
import { createComment, listComments } from '@/server/comments/service';
import { reportComment, reportDuel } from '@/server/reports/service';
import { listDuels } from '@/server/duels/service';
import { likeDuel, unlikeDuel } from '@/server/likes/service';
import { issueSession } from '@/server/auth/session';
import { makeCategory, makeDuel, makeUser, resetDatabase } from './helpers';

let categoryId: string;

beforeEach(async () => {
  await resetDatabase();
  categoryId = (await makeCategory()).id;
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

const sessionUser = (user: { id: string; role: string }) =>
  ({ ...user, role: user.role as 'USER' | 'MODERATOR' | 'ADMIN' }) as never;

describe('comments', () => {
  it('creates a comment and keeps the duel counter in step', async () => {
    const duel = await makeDuel(categoryId);
    const author = await makeUser();

    await createComment(duel.id, sessionUser(author), 'Menimcha Alpha yaxshiroq.');

    expect((await prisma.duel.findUniqueOrThrow({ where: { id: duel.id } })).commentCount).toBe(1);
  });

  it('rejects the same comment posted twice in a row', async () => {
    const duel = await makeDuel(categoryId);
    const author = await makeUser();

    await createComment(duel.id, sessionUser(author), 'Bir xil matn');
    await expect(
      createComment(duel.id, sessionUser(author), 'Bir xil matn'),
    ).rejects.toMatchObject({ code: 'SPAM_DETECTED' });
  });

  it('strips invisible characters rather than storing an "empty" comment', async () => {
    const duel = await makeDuel(categoryId);
    const author = await makeUser();

    await expect(
      createComment(duel.id, sessionUser(author), String.fromCharCode(0x200b, 0x200b)),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('stores comment text verbatim so React escaping is the only XSS boundary', async () => {
    const duel = await makeDuel(categoryId);
    const author = await makeUser();
    const payload = '<script>alert(1)</script>';

    const comment = await createComment(duel.id, sessionUser(author), payload);
    expect(comment.content).toBe(payload);

    const stored = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
    expect(stored.content).toBe(payload);
  });
});

describe('likes', () => {
  it('is idempotent and never double-counts', async () => {
    const duel = await makeDuel(categoryId);
    const user = await makeUser();

    expect((await likeDuel(duel.id, user.id)).likeCount).toBe(1);
    expect((await likeDuel(duel.id, user.id)).likeCount).toBe(1);
    expect((await unlikeDuel(duel.id, user.id)).likeCount).toBe(0);
    // Unliking twice must not drive the counter negative.
    expect((await unlikeDuel(duel.id, user.id)).likeCount).toBe(0);
  });
});

describe('reports', () => {
  it('accepts one report per reporter per target', async () => {
    const duel = await makeDuel(categoryId);
    const reporter = await makeUser();

    await reportDuel(duel.id, 'SPAM', 'looks like spam', { userId: reporter.id });
    await expect(
      reportDuel(duel.id, 'NSFW', undefined, { userId: reporter.id }),
    ).rejects.toMatchObject({ code: 'ALREADY_REPORTED' });

    expect(await prisma.report.count()).toBe(1);
  });

  it('reports a comment against its own target, not the duel', async () => {
    const duel = await makeDuel(categoryId);
    const author = await makeUser();
    const reporter = await makeUser();
    const comment = await createComment(duel.id, sessionUser(author), 'A reportable comment');

    await reportComment(comment.id, 'HARASSMENT', undefined, { userId: reporter.id });

    const report = await prisma.report.findFirstOrThrow();
    expect(report.targetType).toBe('COMMENT');
    expect(report.commentId).toBe(comment.id);
    // The CHECK constraint guarantees the duel side stays null.
    expect(report.duelId).toBeNull();

    await expect(
      reportComment(comment.id, 'SPAM', undefined, { userId: reporter.id }),
    ).rejects.toMatchObject({ code: 'ALREADY_REPORTED' });
  });

  it('accepts anonymous reports', async () => {
    const duel = await makeDuel(categoryId);
    await reportDuel(duel.id, 'SPAM', undefined, { anonId: 'anon-1' });

    const report = await prisma.report.findFirstOrThrow();
    expect(report.reporterId).toBeNull();
    expect(report.reporterAnon).toBe('anon-1');
  });

  it('resolves a report and records who did it', async () => {
    const duel = await makeDuel(categoryId);
    const reporter = await makeUser();
    const moderator = await makeUser({ role: 'MODERATOR' });

    await reportDuel(duel.id, 'SPAM', undefined, { userId: reporter.id });
    const report = await prisma.report.findFirstOrThrow();

    await resolveReport(report.id, moderator.id, 'RESOLVE', 'hidden the duel');

    const resolved = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedById).toBe(moderator.id);
    expect(resolved.resolvedAt).toBeInstanceOf(Date);
  });
});

describe('duel moderation', () => {
  it('hides a duel from every public surface and restores it', async () => {
    const duel = await makeDuel(categoryId);
    await prisma.category.update({ where: { id: categoryId }, data: { duelCount: 1 } });

    await moderateDuel(duel.id, 'HIDE', 'spam');
    expect((await listDuels({ feed: 'trending', limit: 12 }, {})).items).toHaveLength(0);

    await moderateDuel(duel.id, 'RESTORE');
    expect((await listDuels({ feed: 'trending', limit: 12 }, {})).items).toHaveLength(1);
  });

  it('hides a comment and decrements the duel counter exactly once', async () => {
    const duel = await makeDuel(categoryId);
    const author = await makeUser();
    const comment = await createComment(duel.id, sessionUser(author), 'A comment worth hiding');

    await moderateComment(comment.id, 'HIDE');
    expect((await prisma.duel.findUniqueOrThrow({ where: { id: duel.id } })).commentCount).toBe(0);

    // Hiding an already hidden comment must not decrement again.
    await moderateComment(comment.id, 'HIDE');
    expect((await prisma.duel.findUniqueOrThrow({ where: { id: duel.id } })).commentCount).toBe(0);

    const visible = await listComments(duel.id, null);
    expect(visible.items).toHaveLength(0);
  });
});

describe('user moderation', () => {
  it('bans a user and revokes every live session immediately', async () => {
    const admin = await makeUser({ role: 'ADMIN' });
    const target = await makeUser();

    await prisma.session.create({
      data: { userId: target.id, tokenHash: 'hash-1', expiresAt: new Date(Date.now() + 86_400_000) },
    });

    await moderateUser(target.id, admin, 'BAN', { reason: 'abuse' });

    const banned = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(banned.status).toBe('BANNED');
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
  });

  it('refuses to moderate an administrator', async () => {
    const admin = await makeUser({ role: 'ADMIN' });
    const other = await makeUser({ role: 'ADMIN' });

    await expect(moderateUser(other.id, admin, 'BAN')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses to let anyone moderate themselves', async () => {
    const admin = await makeUser({ role: 'ADMIN' });
    await expect(moderateUser(admin.id, admin, 'BAN')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets only an administrator change roles or touch a moderator', async () => {
    const moderator = await makeUser({ role: 'MODERATOR' });
    const otherModerator = await makeUser({ role: 'MODERATOR' });
    const member = await makeUser();

    await expect(
      moderateUser(member.id, moderator, 'PROMOTE'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      moderateUser(otherModerator.id, moderator, 'BAN'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const admin = await makeUser({ role: 'ADMIN' });
    await moderateUser(member.id, admin, 'PROMOTE');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).role).toBe(
      'MODERATOR',
    );
  });
});

describe('sessions', () => {
  it('stores only a hash of the token, never the token itself', async () => {
    const user = await makeUser();
    const { token, expiresAt } = await issueSession(user.id, {
      userAgent: 'test',
      ipHash: 'hashed',
    });

    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.tokenHash).not.toBe(token);
    expect(session.tokenHash).toHaveLength(64);
    expect(session.ipHash).toBe('hashed');
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    // The raw token appears nowhere in the row.
    expect(JSON.stringify(session)).not.toContain(token);
  });
});
