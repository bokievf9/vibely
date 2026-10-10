import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/env'
import type { Database } from '@/types/database.types'

// Session-less client with the publishable (anon) key, for public RPCs called from the server
// (early access waitlist, the landing page's next event). Reads no cookies, so it also works
// inside 'use cache' and in prerendering. Requests time out instead of holding up a build.
export function createAnonClient(timeoutMs = 5000) {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutMs) }),
      },
    },
  )
}
