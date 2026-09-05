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
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws: http://localhost:*' : ''}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(servedOverHttps ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
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
  transpilePackages: ['@dueluz/db'],
  serverExternalPackages: ['@node-rs/argon2', 'sharp', 'ioredis'],
  outputFileTracingRoot: repoRoot,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
