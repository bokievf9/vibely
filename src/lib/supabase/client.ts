'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/env'
import type { Database } from '@/types/database.types'
import { getBrowserToken, type BrowserToken } from './realtime-token'
import { isStaleClientError, reloadForNewVersion } from '@/features/pwa/reload'

const REFRESH_MARGIN_MS = 60_000

let cached: BrowserToken | null = null
let browserClient: ReturnType<typeof createBrowserClient> | undefined

// supabase-js asks for a token before every request, so reuse it until it is about to expire.
async function accessToken(): Promise<string | null> {
  if (!cached || cached.expiresAt - Date.now() < REFRESH_MARGIN_MS) {
    try {
      cached = await getBrowserToken()
    } catch (error) {
      // After a deploy this tab still calls the old action id: retrying can never work, so
      // reload onto the new build (guarded against loops) and carry on without a token.
      if (isStaleClientError(error)) {
        reloadForNewVersion()
        cached = null
        return null
      }
      throw error
    }
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

// The signed-in user's id, read from the borrowed access token (`supabase.auth` is disabled here).
export async function getBrowserUserId(): Promise<string | null> {
  const token = await accessToken()
  if (!token) return null
  try {
    const part = token.split('.')[1] ?? ''
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    const sub = (JSON.parse(json) as { sub?: unknown }).sub
    return typeof sub === 'string' ? sub : null
  } catch {
    return null
  }
}

// Call after sign-out so the next user never reuses the previous token.
export function resetBrowserToken() {
  cached = null
}
