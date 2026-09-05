import { AppError } from './errors';

/**
 * Keyset pagination cursor.
 *
 * Feeds are ordered by a numeric/date sort key plus `id` as a tiebreaker, so a
 * cursor must carry both. Offset pagination is deliberately avoided: it drifts
 * whenever a duel is inserted or its score changes, which is constantly.
 */
export type Cursor = { value: string; id: string };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.value}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const separator = decoded.lastIndexOf('|');
    if (separator <= 0) throw new Error('malformed');
    const value = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    if (!value || !id) throw new Error('malformed');
    return { value, id };
  } catch {
    throw new AppError('BAD_REQUEST', 'Invalid pagination cursor');
  }
}

/**
 * Splits an over-fetched page (limit + 1 rows) into the page itself and the
 * cursor pointing at the next one.
 */
export function paginate<T>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => Cursor,
): { items: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { items: rows, nextCursor: null };
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: last ? encodeCursor(toCursor(last)) : null };
}
