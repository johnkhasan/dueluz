import { describe, expect, it } from 'vitest';
import { assertNotSpam, cleanLine, cleanText, countLinks, toSearchText } from '@/lib/sanitize';
import { hashIp, sign, unsign } from '@/lib/crypto';
import { readAnonId, signAnonId } from '@/lib/anon';
import { detectImageType } from '@/server/uploads/service';
import { assertStrongPassword, hashPassword, verifyPassword } from '@/server/auth/password';
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

describe('passwords', () => {
  it('rejects weak passwords', () => {
    expect(() => assertStrongPassword('short1')).toThrow(AppError);
    expect(() => assertStrongPassword('alllettersonly')).toThrow(AppError);
    expect(() => assertStrongPassword('12345678')).toThrow(AppError);
    expect(() => assertStrongPassword('password123')).toThrow(AppError);
  });

  it('accepts a reasonable password', () => {
    expect(() => assertStrongPassword('Duel1234pass')).not.toThrow();
  });

  it('hashes with argon2id and verifies only the right password', async () => {
    const digest = await hashPassword('Duel1234pass');
    expect(digest.startsWith('$argon2id$')).toBe(true);
    expect(digest).not.toContain('Duel1234pass');

    expect(await verifyPassword(digest, 'Duel1234pass')).toBe(true);
    expect(await verifyPassword(digest, 'Duel1234pas')).toBe(false);
  });

  it('returns false rather than throwing on a malformed digest', async () => {
    expect(await verifyPassword('not-a-digest', 'anything')).toBe(false);
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
    expect(RATE_LIMITS.register.limit).toBeGreaterThanOrEqual(20);
    expect(RATE_LIMITS.login.limit).toBeGreaterThanOrEqual(30);
  });
});
