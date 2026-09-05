import IORedis, { type Redis } from 'ioredis';
import { env } from './env';

declare global {
  var __dueluzRedis: Redis | null | undefined;
}

let warned = false;

/**
 * Returns a shared Redis connection, or `null` when REDIS_URL is not set or the
 * server is unreachable. Every caller must degrade gracefully — Redis is a
 * performance and abuse-control layer, never a source of truth.
 */
export function getRedis(): Redis | null {
  if (globalThis.__dueluzRedis !== undefined) return globalThis.__dueluzRedis;

  if (!env.REDIS_URL) {
    globalThis.__dueluzRedis = null;
    return null;
  }

  try {
    const client = new IORedis(env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
    });

    client.on('error', (error: Error) => {
      if (!warned) {
        warned = true;
        console.warn('[redis] unavailable, falling back to in-process cache:', error.message);
      }
    });

    globalThis.__dueluzRedis = client;
    return client;
  } catch (error) {
    console.warn('[redis] failed to initialise:', error);
    globalThis.__dueluzRedis = null;
    return null;
  }
}

/** Reads a JSON value, swallowing every Redis-side failure. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Writes a JSON value with a TTL, swallowing every Redis-side failure. */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    /* cache writes are best-effort */
  }
}

export async function cacheDelete(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    /* best-effort */
  }
}

/**
 * Sets a key only if it does not exist. Used for "once per window" guards such
 * as view counting. Returns false when Redis is unavailable so callers treat
 * the action as already-done rather than double-counting.
 */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch {
    return false;
  }
}
