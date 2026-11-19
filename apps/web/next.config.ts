import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV !== 'production';
// Static demo build (GitHub Pages): no server, no API routes. See docs/DECISIONS.md D-018.
const isStatic = process.env.NEXT_PUBLIC_STATIC === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;
const tiles = 'https://tiles.openfreemap.org';

// Tight CSP: scripts and styles only from us; map tiles from the configured tile host.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${tiles}${dev ? ' ws:' : ''}`,
  "worker-src 'self' blob:",
  "child-src blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const config: NextConfig = {
  transpilePackages: ['@maploom/core', '@maploom/geo', '@maploom/render', '@maploom/server'],
  serverExternalPackages: ['@electric-sql/pglite', '@resvg/resvg-js', 'pg'],
  poweredByHeader: false,
  // Server-only pages are named *.dyn.tsx and API routes are route.ts; the static build only sees .tsx pages.
  pageExtensions: isStatic ? ['tsx'] : ['dyn.tsx', 'tsx', 'ts'],
  ...(isStatic ? { output: 'export' as const, basePath, images: { unoptimized: true }, trailingSlash: true } : {}),
  ...(isStatic ? {} : { headers })
};

async function headers() {
  return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
        ],
      },
    ];
}

export default config;
