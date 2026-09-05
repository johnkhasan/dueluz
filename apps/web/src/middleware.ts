import { NextResponse, type NextRequest } from 'next/server';
import { isValidAnonCookie, signAnonIdEdge } from '@/lib/anon-edge';
import { ANON_MAX_AGE_SECONDS, COOKIES } from '@/lib/cookies';
import { defaultLocale, isLocale, negotiateLocale } from '@/lib/i18n/config';

/** Paths that must never be locale-prefixed. */
const PASSTHROUGH = [
  '/api',
  '/_next',
  '/uploads',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (PASSTHROUGH.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  const issuedAnonCookie = await ensureAnonIdentity(request);
  const first = pathname.split('/')[1];

  // Every page lives under an explicit locale prefix so each translation has a
  // canonical, indexable URL and hreflang can be emitted correctly.
  if (!isLocale(first)) {
    const cookieLocale = request.cookies.get(COOKIES.locale)?.value;
    const preferred = isLocale(cookieLocale)
      ? cookieLocale
      : (negotiateLocale(request.headers.get('accept-language')) ?? defaultLocale);

    const url = request.nextUrl.clone();
    url.pathname = `/${preferred}${pathname === '/' ? '' : pathname}`;
    return attach(NextResponse.redirect(url), issuedAnonCookie);
  }

  // Forwarding the mutated request headers is what lets the Server Component
  // rendering this very request already see a freshly minted anon cookie.
  return attach(NextResponse.next({ request: { headers: request.headers } }), issuedAnonCookie);
}

/**
 * Issues the anonymous voter cookie on first contact and returns its value when
 * a new one was minted.
 *
 * Doing this in middleware rather than lazily on the first vote means a duel
 * page rendered on the server already knows whether this visitor has voted, so
 * results appear without a flash of the pre-vote state.
 */
async function ensureAnonIdentity(request: NextRequest): Promise<string | null> {
  const secret = process.env.ANON_SECRET;
  if (!secret) return null;

  const existing = request.cookies.get(COOKIES.anon)?.value;
  if (existing && (await isValidAnonCookie(existing, secret))) return null;

  const signed = await signAnonIdEdge(crypto.randomUUID(), secret);
  request.cookies.set(COOKIES.anon, signed);
  return signed;
}

function attach(response: NextResponse, anonCookie: string | null): NextResponse {
  if (anonCookie) {
    response.cookies.set(COOKIES.anon, anonCookie, {
      httpOnly: true,
      // Matches `useSecureCookies` in lib/env: keyed to the real origin, not
      // NODE_ENV, so an http deployment does not silently lose the cookie.
      secure: (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://'),
      sameSite: 'lax',
      path: '/',
      maxAge: ANON_MAX_AGE_SECONDS,
    });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
