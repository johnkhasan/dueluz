import { AppError } from './errors';
import { APP_URL, isProduction } from './env';

/**
 * Best-effort client IP. Trusts `x-forwarded-for` only because the app is
 * expected to sit behind a reverse proxy that overwrites it; the value is only
 * ever used in hashed form for rate limiting.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? request.headers.get('cf-connecting-ip') ?? null;
}

export function userAgent(request: Request): string | null {
  return request.headers.get('user-agent')?.slice(0, 400) ?? null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated mutations.
 *
 * Session cookies are SameSite=Lax, which already blocks cross-site form posts.
 * This is the second layer: state-changing requests must declare an Origin that
 * matches the app's own origin.
 */
export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;

  const origin = request.headers.get('origin');
  if (!origin) {
    // A browser always sends Origin on mutations. Absence means a non-browser
    // client (curl, tests, server-to-server) — allowed outside production only.
    if (isProduction) throw new AppError('CSRF_FAILED', 'Missing Origin header');
    return;
  }

  const allowed = new Set([APP_URL]);
  const host = request.headers.get('host');
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }

  if (!allowed.has(origin.replace(/\/$/, ''))) {
    throw new AppError('CSRF_FAILED', 'Cross-origin request rejected');
  }
}

/** Absolute URL for a path, used for canonical links and share URLs. */
export function absoluteUrl(path: string): string {
  return `${APP_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
