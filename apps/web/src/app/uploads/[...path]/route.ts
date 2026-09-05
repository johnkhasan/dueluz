import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * Serves files written by the local storage driver.
 *
 * Next only indexes `public/` when the server starts, so files uploaded at
 * runtime are invisible to its static handler — in a standalone container
 * every uploaded image 404s. Serving them from here makes the application
 * correct on its own, with no reverse-proxy configuration required.
 *
 * A proxy may still short-circuit this route with a direct file alias for
 * performance; that is an optimisation, not a requirement.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // With the S3 driver nothing is on local disk; the URLs point at the bucket.
  if (env.STORAGE_DRIVER !== 'local') {
    return new NextResponse('Not found', { status: 404 });
  }

  const { path } = await params;
  const root = resolve(env.LOCAL_STORAGE_DIR);
  const target = resolve(root, ...path);

  // Path traversal: `..` segments, absolute segments and symlink-style escapes
  // must never reach outside the storage root.
  if (target !== root && !target.startsWith(root + sep)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const contentType = CONTENT_TYPES[extname(target).toLowerCase()];
  if (!contentType) {
    return new NextResponse('Not found', { status: 404 });
  }

  let size: number;
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not a file');
    size = info.size;
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>;

  return new NextResponse(stream, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(size),
      // Every upload gets a fresh UUID key, so a stored file never changes.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
