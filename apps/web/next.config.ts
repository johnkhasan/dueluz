import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { NextConfig } from 'next';

// A single .env lives at the repo root and is shared by the web app, Prisma
// and the test runners. Loading it here populates process.env for both the
// build (NEXT_PUBLIC_* inlining) and the running server.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
loadEnv({ path: resolve(repoRoot, '.env') });

const isDev = process.env.NODE_ENV === 'development';

/**
 * `upgrade-insecure-requests` rewrites every subresource URL to https. On an
 * origin that is actually served over http - local development, or an http
 * staging box - that turns every script and stylesheet into a failed TLS
 * handshake and the page renders unstyled and unhydrated. So it is emitted
 * only when the app really is on https.
 */
const servedOverHttps = (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://');

/**
 * Content-Security-Policy.
 * `unsafe-inline` for styles is required by Next's inlined critical CSS;
 * `unsafe-eval` is dev-only (React Refresh).
 */
/**
 * Telegram sign-in is the only way into the product, and the login widget is a
 * third-party script that renders an iframe from oauth.telegram.org. Both
 * origins have to be allowed or nobody can sign in: the widget is blocked
 * silently and the page just shows an empty box.
 */
const TELEGRAM_SCRIPT_ORIGIN = 'https://telegram.org';
const TELEGRAM_FRAME_ORIGIN = 'https://oauth.telegram.org';

/**
 * `telegram-widget.js` evaluates strings as JavaScript, so the login page
 * additionally needs 'unsafe-eval'. That relaxation is confined to that one
 * route: it renders no user-generated content, while every page that does —
 * feeds, duels, comments, admin — keeps the strict policy.
 */
function buildCsp({ allowEval }: { allowEval: boolean }): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    TELEGRAM_SCRIPT_ORIGIN,
    ...(allowEval || isDev ? ["'unsafe-eval'"] : []),
  ].join(' ');

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${TELEGRAM_SCRIPT_ORIGIN}${isDev ? ' ws: http://localhost:*' : ''}`,
    `frame-src ${TELEGRAM_FRAME_ORIGIN} ${TELEGRAM_SCRIPT_ORIGIN}`,
    // What may frame this site; the directive above is what this site may frame.
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(servedOverHttps ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

const csp = buildCsp({ allowEval: false });
const loginCsp = buildCsp({ allowEval: true });

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  ...(isDev
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Traced, self-contained server bundle for the container image.
  output: 'standalone',
  transpilePackages: ['@dueluz/db'],
  serverExternalPackages: ['sharp', 'ioredis'],
  outputFileTracingRoot: repoRoot,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/:locale(uz|ru|en)/login',
        headers: [...securityHeaders, { key: 'Content-Security-Policy', value: loginCsp }],
      },
      {
        // Everything except the login page. The negative lookahead matters:
        // if both rules matched, the browser would receive two CSP headers and
        // enforce their intersection, which is the strict one.
        source: '/((?!(?:uz|ru|en)/login$).*)',
        headers: [...securityHeaders, { key: 'Content-Security-Policy', value: csp }],
      },
    ];
  },
};

export default nextConfig;
