import { PrismaClient, Prisma } from '@prisma/client';

export * from '@prisma/client';
export { Prisma };

declare global {
  var __dueluzPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.PRISMA_LOG === 'query'
        ? ['query', 'warn', 'error']
        : process.env.NODE_ENV === 'development'
          ? ['warn', 'error']
          : ['error'],
  });
}

/**
 * Single shared client. In development Next.js re-evaluates modules on every
 * hot reload, which would otherwise exhaust the connection pool.
 */
export const prisma: PrismaClient = globalThis.__dueluzPrisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__dueluzPrisma = prisma;
}

/** Postgres unique-constraint violation. Used to turn races into clean errors. */
export function isUniqueViolation(error: unknown, target?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  if (!target) return true;
  const meta = error.meta as { target?: string[] | string } | undefined;
  const raw = meta?.target;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.some((entry) => entry.includes(target));
}

/** Postgres foreign-key / record-not-found violation. */
export function isNotFoundViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
