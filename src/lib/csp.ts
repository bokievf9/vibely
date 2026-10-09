// Content-Security-Policy, sent from next.config.ts in production.
//
// Why no nonce: Next.js can only nonce scripts of pages rendered per request. With Cache
// Components / Partial Prerendering the static shells (landing, login, every page's shell) are
// built once, so a per-request nonce would force every page dynamic and disable PPR
// (see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// So script-src keeps 'unsafe-inline' (needed for the inline hydration/flight scripts) but
// pins script origins to self + Turnstile + the analytics host, and every other directive is
// strict: no plugins, no <base> hijack, no foreign form posts, no framing, no foreign fetches.
// The JSON-LD <script type="application/ld+json"> is a data block, not executed, so CSP
// does not apply to it.

const TURNSTILE = 'https://challenges.cloudflare.com'
// Umami Cloud serves its script from cloud.umami.is but sends events to its API gateway.
const ANALYTICS_EXTRA_CONNECT: Record<string, string[]> = {
  'https://cloud.umami.is': ['https://api-gateway.umami.dev', 'https://gateway.umami.is'],
}

type CspInput = { supabaseUrl: string; analyticsSrc?: string; rtcUrl?: string; isDev?: boolean }

// LiveKit (calls): signalling WebSocket plus its HTTPS API on the same host, e.g.
// wss://rtc.vibelydate.com → wss://rtc.vibelydate.com https://rtc.vibelydate.com.
// Media itself (WebRTC/TURN) is not governed by CSP.
function rtcOrigins(rtcUrl: string | undefined): string[] {
  if (!rtcUrl) return []
  try {
    const host = new URL(rtcUrl).host
    return [`wss://${host}`, `https://${host}`]
  } catch {
    return []
  }
}

export function buildCsp({ supabaseUrl, analyticsSrc, rtcUrl, isDev = false }: CspInput): string {
  const supabase = new URL(supabaseUrl)
  const supabaseWs = `${supabase.protocol === 'https:' ? 'wss:' : 'ws:'}//${supabase.host}`
  const analytics = analyticsSrc ? [new URL(analyticsSrc).origin] : []
  const analyticsConnect = analytics.flatMap((o) => [o, ...(ANALYTICS_EXTRA_CONNECT[o] ?? [])])

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
      TURNSTILE,
      ...analytics,
    ],
    // Tailwind is a file, but framer-motion and React style={} write inline styles.
    'style-src': ["'self'", "'unsafe-inline'"],
    // blob: = selfie preview, data: = image compression; Supabase = signed storage URLs.
    'img-src': ["'self'", 'blob:', 'data:', supabase.origin],
    'font-src': ["'self'"],
    'connect-src': [
      "'self'",
      supabase.origin,
      supabaseWs,
      ...analyticsConnect,
      ...rtcOrigins(rtcUrl),
    ],
    // blob: = camera/mic previews while recording; Supabase = signed voice/video message URLs.
    // Call media streams are MediaStream objects (no URL).
    'media-src': ["'self'", 'blob:', supabase.origin],
    'frame-src': [TURNSTILE],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`)
  if (!isDev) policy.push('upgrade-insecure-requests')
  return policy.join('; ')
}
