import { z } from 'zod'

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Public and known, so a missing value must not break the build.
  NEXT_PUBLIC_SITE_URL: z.url().default('https://vibelydate.com'),
  // Optional: Web Push is switched off when the VAPID key pair is not configured.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
})

// NEXT_PUBLIC_* must be referenced statically so Next.js can inline them in the client bundle.
// Only these two Supabase values are required to build (see CLAUDE.md).
export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
})
