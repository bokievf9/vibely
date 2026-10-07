import 'server-only'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'
import type { Database } from '@/types/database.types'
import { authCookieOptions } from './config'

// Per-request client for Server Components, Server Actions and Route Handlers.
// With Cache Components on, call it only inside a <Suspense> boundary (it reads cookies).
export async function createClient() {
  // The auth client reads the clock (session expiry) as soon as it is created; mark the render as
  // request-time first, or Cache Components flags Date.now() during prerendering.
  await connection()
  const cookieStore = await cookies()

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component: cookies are read-only there.
            // Safe to ignore because src/proxy.ts refreshes the session on every request.
          }
        },
      },
    },
  )
}
