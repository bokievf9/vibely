import type { NextConfig } from 'next'
import { buildCsp } from './src/lib/csp'
import { analyticsConfig } from './src/lib/env.optional'

const isProd = process.env.NODE_ENV === 'production'
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321')
// Headers are fixed at build time: the calls host comes from LIVEKIT_URL in the build environment
// (GitHub variable) and falls back to the planned media server (docs/calls.md).
const rtcUrl = process.env.LIVEKIT_URL || 'wss://rtc.vibelydate.com'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Camera: selfie verification, video messages and video calls; microphone: voice/video messages
  // and calls; geolocation: distance filters.
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(self)' },
  // Production only: served over HTTPS (Certbot on Nginx); dev needs HMR/eval. See src/lib/csp.ts.
  ...(isProd
    ? [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        {
          key: 'Content-Security-Policy',
          value: buildCsp({
            supabaseUrl: supabaseUrl.href,
            analyticsSrc: analyticsConfig?.src,
            rtcUrl,
          }),
        },
      ]
    : []),
]

const nextConfig: NextConfig = {
  // Self-contained server bundle: built in CI, shipped to the VPS as a release (scripts/deploy).
  output: 'standalone',
  poweredByHeader: false,
  // Version-skew protection. CI sets NEXT_DEPLOYMENT_ID to the commit id: Next uses it for asset
  // URLs and hard navigations on mismatch; the same id is inlined here so open tabs and installed
  // PWAs can compare it with /api/version and reload themselves after a deploy
  // (src/features/pwa/components/version-watcher.tsx).
  env: { NEXT_PUBLIC_BUILD_ID: process.env.NEXT_DEPLOYMENT_ID || 'dev' },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol === 'https:' ? 'https' : 'http',
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port,
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },
  // "Random chat" became Blind Dating: old links, bookmarks and push notifications keep working.
  async redirects() {
    return [
      {
        source: '/:lang(en|ms|ru)/randomizer',
        destination: '/:lang/blind-date',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
