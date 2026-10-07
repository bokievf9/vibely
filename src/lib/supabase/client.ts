'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/env'
import type { Database } from '@/types/database.types'
import { getBrowserToken, type BrowserToken } from './realtime-token'

const REFRESH_MARGIN_MS = 60_000

let cached: BrowserToken | null = null
let browserClient: ReturnType<typeof createBrowserClient> | undefined

// supabase-js asks for a token before every request, so reuse it until it is about to expire.
async function accessToken(): Promise<string | null> {
  if (!cached || cached.expiresAt - Date.now() < REFRESH_MARGIN_MS) {
    cached = await getBrowserToken()
  }
  return cached?.token ?? null
}

function createBrowserClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // Session cookies are HTTP-only, so the browser borrows a token from the server.
      // `supabase.auth.*` is disabled on this client: sign-in/out goes through Server Actions.
      accessToken,
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

// Singleton browser client for Realtime channels, Storage uploads and RLS-scoped reads.
export function getBrowserClient() {
  browserClient ??= createBrowserClient()
  return browserClient
}

// Call after sign-out so the next user never reuses the previous token.
export function resetBrowserToken() {
  cached = null
}
