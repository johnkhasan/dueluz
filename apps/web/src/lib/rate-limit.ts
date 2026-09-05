import { AppError } from './errors';
import { getRedis } from './redis';

export type RateLimitRule = {
  /** Stable identifier, used as the Redis key prefix. */
  name: string;
  /** Allowed requests per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetSeconds: number;
};

/**
 * Rate-limit budgets.
 *
 * IP-keyed budgets are deliberately generous. Uzbek mobile carriers run
 * large-scale CGNAT, so a single public IP can front thousands of genuine
 * visitors; a budget tight enough to stop one scripted abuser would lock out a
 * whole carrier. The tight, cheap-to-enforce limits are the account-keyed ones,
 * and correctness (the unique vote constraint) never depends on rate limiting.
 */
export const RATE_LIMITS = {
  vote: { name: 'vote', limit: 60, windowSeconds: 60 },
  duelCreate: { name: 'duel-create', limit: 5, windowSeconds: 3600 },
  comment: { name: 'comment', limit: 10, windowSeconds: 60 },
  commentLike: { name: 'comment-like', limit: 60, windowSeconds: 60 },
  duelLike: { name: 'duel-like', limit: 60, windowSeconds: 60 },
  telegramAuth: { name: 'telegram-auth', limit: 30, windowSeconds: 900 },
  upload: { name: 'upload', limit: 20, windowSeconds: 3600 },
  report: { name: 'report', limit: 10, windowSeconds: 3600 },
  share: { name: 'share', limit: 60, windowSeconds: 3600 },
  events: { name: 'events', limit: 120, windowSeconds: 60 },
  search: { name: 'search', limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

// ---------------------------------------------------------------------------
// In-process fallback (single instance only — Redis is required in production
// for this to be effective across replicas).
// ---------------------------------------------------------------------------

type Bucket = { count: number; expiresAt: number };
const memory = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of memory) {
    if (bucket.expiresAt <= now) memory.delete(key);
  }
}

function consumeInMemory(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const windowMs = rule.windowSeconds * 1000;
  const existing = memory.get(key);

  if (!existing || existing.expiresAt <= now) {
    memory.set(key, { count: 1, expiresAt: now + windowMs });
    return {
      allowed: true,
      remaining: rule.limit - 1,
      limit: rule.limit,
      resetSeconds: rule.windowSeconds,
    };
  }

  existing.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
  return {
    allowed: existing.count <= rule.limit,
    remaining: Math.max(0, rule.limit - existing.count),
    limit: rule.limit,
    resetSeconds,
  };
}

/**
 * Fixed-window counter. Chosen over a sliding log because it costs a single
 * round-trip and the burst it allows at a window boundary (2x for one instant)
 * is irrelevant at these budgets.
 */
export async function consume(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
  const key = `rl:${rule.name}:${identifier}`;
  const redis = getRedis();

  if (redis) {
    try {
      const [countRaw, ttlRaw] = (await redis
        .multi()
        .incr(key)
        .ttl(key)
        .exec()) as [[Error | null, number], [Error | null, number]];

      const count = countRaw[1];
      let ttl = ttlRaw[1];
      if (ttl < 0) {
        await redis.expire(key, rule.windowSeconds);
        ttl = rule.windowSeconds;
      }

      return {
        allowed: count <= rule.limit,
        remaining: Math.max(0, rule.limit - count),
        limit: rule.limit,
        resetSeconds: ttl,
      };
    } catch {
      // fall through to the in-process limiter
    }
  }

  return consumeInMemory(key, rule);
}

/** Consumes a token and throws `RATE_LIMITED` when the budget is exhausted. */
export async function enforce(rule: RateLimitRule, identifier: string): Promise<void> {
  const result = await consume(rule, identifier);
  if (!result.allowed) {
    throw new AppError(
      'RATE_LIMITED',
      `Too many requests. Try again in ${result.resetSeconds} second(s).`,
      { retryAfter: result.resetSeconds },
    );
  }
}

/** Test-only: clears the in-process buckets. */
export function __resetRateLimits() {
  memory.clear();
}
