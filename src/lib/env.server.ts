import 'server-only'
import { z } from 'zod'

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
})

type ServerEnv = z.infer<typeof serverEnvSchema>
let cached: ServerEnv | undefined

// Validated on first use, not at import: the site must build and serve even if the secret is
// missing; only features that need it (the admin panel) fail, with a clear message.
// `server-only` keeps this module, and the key, out of every client bundle.
export function getServerEnv(): ServerEnv {
  if (cached) return cached
  const parsed = serverEnvSchema.safeParse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY })
  if (!parsed.success) {
    throw new Error(
      'SUPABASE_SECRET_KEY is not set: add it to the server environment (.env.production)',
    )
  }
  cached = parsed.data
  return cached
}

const pushEnvSchema = z.object({
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/),
})

export type PushEnv = z.infer<typeof pushEnvSchema>
let pushCached: PushEnv | null | undefined

// Web Push is optional: returns null (feature off) unless all three VAPID values are set.
export function getPushEnv(): PushEnv | null {
  if (pushCached !== undefined) return pushCached
  const parsed = pushEnvSchema.safeParse({
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  })
  pushCached = parsed.success ? parsed.data : null
  return pushCached
}

const cronEnvSchema = z.string().min(32)
let cronCached: string | null | undefined

// Shared secret of the scheduled jobs (POST /api/cron/*, sent by GitHub Actions as a Bearer
// token). Optional: returns null (jobs disabled) unless CRON_SECRET is set, ≥ 32 characters.
export function getCronSecret(): string | null {
  if (cronCached !== undefined) return cronCached
  const parsed = cronEnvSchema.safeParse(process.env.CRON_SECRET)
  cronCached = parsed.success ? parsed.data : null
  return cronCached
}

// Cloudflare Turnstile secret for forms the app verifies itself (the early access waitlist).
// Optional: without it the token is not checked and only the database rate limits apply.
// The sign-in captcha is verified by Supabase Auth with its own copy of the secret.
export function getTurnstileSecret(): string | null {
  const value = process.env.TURNSTILE_SECRET_KEY?.trim()
  return value ? value : null
}
