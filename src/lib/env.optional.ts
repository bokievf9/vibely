import { z } from 'zod'

// Optional integrations. Each one is validated on its own: a missing or malformed value only
// disables that feature instead of breaking the whole site like a bad required variable would.
// NEXT_PUBLIC_* must be referenced statically so Next.js can inline them in the client bundle.

const httpsUrl = z.url({ protocol: /^https$/ })
const siteId = z.string().trim().min(1).max(200)

function pick<T>(schema: z.ZodType<T>, value: string | undefined): T | undefined {
  const parsed = schema.safeParse(value || undefined)
  return parsed.success ? parsed.data : undefined
}

const analyticsSrc = pick(httpsUrl, process.env.NEXT_PUBLIC_ANALYTICS_SRC)
const analyticsSiteId = pick(siteId, process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID)

// Umami or Plausible script, e.g. https://cloud.umami.is/script.js + website id.
export const analyticsConfig =
  analyticsSrc && analyticsSiteId ? { src: analyticsSrc, siteId: analyticsSiteId } : undefined

// Cloudflare Turnstile (captcha on the phone form). The secret lives in Supabase Auth settings.
export const turnstileSiteKey = pick(siteId, process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
