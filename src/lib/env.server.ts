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
    throw new Error('SUPABASE_SECRET_KEY is not set: add it to the server environment (.env.production)')
  }
  cached = parsed.data
  return cached
}
