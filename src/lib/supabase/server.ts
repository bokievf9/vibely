import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'
import type { Database } from '@/types/database.types'
import { authCookieOptions } from './config'

// Per-request client for Server Components, Server Actions and Route Handlers.
// With Cache Components on, call it only inside a <Suspense> boundary (it reads cookies).
export async function createClient() {
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
