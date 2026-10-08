import type { NextConfig } from 'next'
import { buildCsp } from './src/lib/csp'
import { analyticsConfig } from './src/lib/env.optional'

const isProd = process.env.NODE_ENV === 'production'
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Camera is needed for selfie verification, geolocation for distance filters.
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
  // Production only: served over HTTPS (Certbot on Nginx); dev needs HMR/eval. See src/lib/csp.ts.
  ...(isProd
    ? [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        {
          key: 'Content-Security-Policy',
          value: buildCsp({ supabaseUrl: supabaseUrl.href, analyticsSrc: analyticsConfig?.src }),
        },
      ]
    : []),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
