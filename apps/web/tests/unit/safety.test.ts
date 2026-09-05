import { describe, expect, it } from 'vitest';
import { assertNotSpam, cleanLine, cleanText, countLinks, toSearchText } from '@/lib/sanitize';
import { createHash, createHmac } from 'node:crypto';
import { hashIp, sign, unsign } from '@/lib/crypto';
import { readAnonId, signAnonId } from '@/lib/anon';
import { detectImageType } from '@/server/uploads/service';
import { verifyInitData, verifyWidgetLogin } from '@/server/auth/telegram';
import { hasRole } from '@/server/auth/guards';
import { AppError } from '@/lib/errors';
import { imageLocationSchema } from '@/lib/validation';
import { RATE_LIMITS, __resetRateLimits, consume } from '@/lib/rate-limit';

describe('text sanitisation', () => {
  it('strips zero-width characters used to fake non-empty content', () => {
    const zeroWidth = String.fromCharCode(0x200b, 0x200b, 0x200b);
    expect(cleanText(zeroWidth)).toBe('');
    expect(cleanText(`he${zeroWidth}llo`)).toBe('hello');
  });

  it('strips control characters but keeps newlines', () => {
    expect(cleanText(`a${String.fromCharCode(7)}b\nc`)).toBe('ab\nc');
  });

  it('collapses newlines out of single-line fields', () => {
    expect(cleanLine('iPhone\n\n17  Pro')).toBe('iPhone 17 Pro');
  });

  it('builds search text from every searchable part', () => {
    expect(toSearchText(['iPhone 17 Pro!', null, 'Galaxy S26', 'Technology'])).toBe(
      'iphone 17 pro galaxy s26 technology',
    );
  });
});

describe('spam heuristics', () => {
  it('counts links', () => {
    expect(countLinks('see http://a.com and www.b.com')).toBe(2);
  });

  it('rejects link spam', () => {
    expect(() => assertNotSpam('http://a.com http://b.com', { maxLinks: 1 })).toThrow(AppError);
  });

  it('rejects shouting and character floods', () => {
    expect(() => assertNotSpam('THIS IS COMPLETELY UNACCEPTABLE')).toThrow(AppError);
    expect(() => assertNotSpam('aaaaaaaaaaaaaaa')).toThrow(AppError);
  });

  it('leaves ordinary comments alone', () => {
    expect(() => assertNotSpam('Menimcha iPhone yaxshiroq, lekin narxi qimmat.')).not.toThrow();
    expect(() => assertNotSpam('OK!')).not.toThrow();
  });
});

describe('privacy-preserving identifiers', () => {
  it('never returns the raw IP', () => {
    const hash = hashIp('192.0.2.42');
    expect(hash).not.toContain('192.0.2.42');
    expect(hash).toHaveLength(32);
  });

  it('is stable within a day so same-day abuse is detectable', () => {
    expect(hashIp('192.0.2.42')).toBe(hashIp('192.0.2.42'));
    expect(hashIp('192.0.2.42')).not.toBe(hashIp('192.0.2.43'));
  });

  it('returns null when there is no IP to hash', () => {
    expect(hashIp(null)).toBeNull();
  });
});

describe('signed anonymous identity', () => {
  it('round-trips a signed value', () => {
    const signed = signAnonId('abc-123');
    expect(readAnonId(signed)).toBe('abc-123');
  });

  it('rejects a forged cookie so identities cannot be minted client-side', () => {
    expect(readAnonId('abc-123.forgedsignature')).toBeNull();
    expect(readAnonId('abc-123')).toBeNull();
    expect(readAnonId(undefined)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const signed = signAnonId('abc-123');
    expect(readAnonId(signed.replace('abc', 'xyz'))).toBeNull();
  });

  it('signs and unsigns with an explicit secret', () => {
    const value = sign('payload', 'a-secret-that-is-long-enough-here');
    expect(unsign(value, 'a-secret-that-is-long-enough-here')).toBe('payload');
    expect(unsign(value, 'a-different-secret-of-equal-length')).toBeNull();
  });
});

describe('upload type detection', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const webp = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('WEBP', 'ascii'),
  ]);

  it('detects real image types from their leading bytes', () => {
    expect(detectImageType(jpeg)).toBe('jpeg');
    expect(detectImageType(png)).toBe('png');
    expect(detectImageType(webp)).toBe('webp');
  });

  /** The classic stored-XSS vector: HTML or SVG wearing a .jpg extension. */
  it('rejects payloads that are not images regardless of their name', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(detectImageType(Buffer.from('<!DOCTYPE html><script>alert(1)</script>'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('image locations', () => {
  const parse = (value: string) => imageLocationSchema.safeParse(value).success;

  /**
   * Regression: the schema used to demand `z.string().url()`, which rejected
   * the root-relative paths the local storage driver returns. Publishing a duel
   * with an uploaded image failed with VALIDATION_ERROR in the default
   * configuration.
   */
  it('accepts what the local storage driver returns', () => {
    expect(parse('/uploads/duel/cmto6gso/0e83eb4f-a885.webp')).toBe(true);
    expect(parse('/uploads/avatar/abc/def.webp')).toBe(true);
  });

  it('accepts what the S3 driver returns', () => {
    expect(parse('https://cdn.duel.uz/duel/abc/def.webp')).toBe(true);
  });

  it('rejects locations that are not images we served', () => {
    // Protocol-relative: would load from an attacker's host.
    expect(parse('//evil.example/x.png')).toBe(false);
    expect(parse('javascript:alert(1)')).toBe(false);
    expect(parse('data:image/svg+xml;base64,AAAA')).toBe(false);
    // Plain http would be blocked by the CSP and break the padlock.
    expect(parse('http://evil.example/x.png')).toBe(false);
    expect(parse('uploads/no-leading-slash.webp')).toBe(false);
    expect(parse(`/uploads/${'a'.repeat(600)}.webp`)).toBe(false);
  });
});

const BOT_TOKEN = '1234567:test-bot-token-for-unit-tests';

/** Signs a payload exactly the way Telegram's Login Widget does. */
function signWidget(fields: Record<string, string | number>) {
  const check = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secret = createHash('sha256').update(BOT_TOKEN).digest();
  return { ...fields, hash: createHmac('sha256', secret).update(check).digest('hex') };
}

/** Signs a Mini App initData query string the way the Telegram client does. */
function signInitData(fields: Record<string, string>) {
  const check = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = () => Math.floor(Date.now() / 1000);

describe('telegram sign-in', () => {
  it('accepts a correctly signed widget payload', () => {
    const payload = signWidget({
      id: 4242,
      first_name: 'Javohir',
      last_name: 'Hasanov',
      username: 'javohir',
      photo_url: 'https://t.me/i/userpic/320/javohir.jpg',
      auth_date: now(),
    });

    expect(verifyWidgetLogin(payload as never)).toMatchObject({
      telegramId: '4242',
      firstName: 'Javohir',
      username: 'javohir',
      photoUrl: 'https://t.me/i/userpic/320/javohir.jpg',
    });
  });

  it('rejects a payload whose fields were edited after signing', () => {
    const payload = signWidget({ id: 4242, first_name: 'Javohir', auth_date: now() });
    // Impersonating another account is the whole attack this prevents.
    expect(() => verifyWidgetLogin({ ...payload, id: 9999 } as never)).toThrow(AppError);
  });

  it('rejects a stale login', () => {
    const payload = signWidget({
      id: 4242,
      first_name: 'Javohir',
      auth_date: now() - 60 * 60,
    });
    expect(() => verifyWidgetLogin(payload as never)).toThrow(AppError);
  });

  it('drops an avatar that is not hosted by Telegram', () => {
    const payload = signWidget({
      id: 4242,
      first_name: 'Javohir',
      photo_url: 'https://evil.example/track.png',
      auth_date: now(),
    });
    expect(verifyWidgetLogin(payload as never).photoUrl).toBeNull();
  });

  it('accepts signed Mini App initData and reads the user out of it', () => {
    const initData = signInitData({
      auth_date: String(now()),
      query_id: 'AAE',
      user: JSON.stringify({ id: 777, first_name: 'Malika', username: 'malika', language_code: 'ru' }),
    });

    expect(verifyInitData({ initData })).toMatchObject({
      telegramId: '777',
      firstName: 'Malika',
      username: 'malika',
      locale: 'ru',
    });
  });

  it('rejects initData with a forged hash', () => {
    const initData = signInitData({
      auth_date: String(now()),
      user: JSON.stringify({ id: 777, first_name: 'Malika' }),
    }).replace(/hash=.*$/, `hash=${'0'.repeat(64)}`);

    expect(() => verifyInitData({ initData })).toThrow(AppError);
  });
});

describe('role hierarchy', () => {
  it('treats roles as hierarchical', () => {
    expect(hasRole({ role: 'ADMIN' }, 'MODERATOR')).toBe(true);
    expect(hasRole({ role: 'MODERATOR' }, 'MODERATOR')).toBe(true);
    expect(hasRole({ role: 'USER' }, 'MODERATOR')).toBe(false);
    expect(hasRole({ role: 'MODERATOR' }, 'ADMIN')).toBe(false);
  });
});

describe('rate limiting', () => {
  it('allows the budget then blocks, per identifier', async () => {
    __resetRateLimits();
    const rule = { name: 'test', limit: 3, windowSeconds: 60 };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await consume(rule, 'user-a');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3 - attempt);
    }

    expect((await consume(rule, 'user-a')).allowed).toBe(false);
    // A different identifier has its own budget.
    expect((await consume(rule, 'user-b')).allowed).toBe(true);
  });

  it('keeps IP-keyed budgets generous enough for carrier-grade NAT', () => {
    expect(RATE_LIMITS.telegramAuth.limit).toBeGreaterThanOrEqual(30);
    expect(RATE_LIMITS.vote.limit).toBeGreaterThanOrEqual(60);
  });
});
