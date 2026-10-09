'use server'

import { createClient, dropDeadSession } from './server'

export type BrowserToken = { token: string; expiresAt: number }

// Hands the browser a short-lived access token (JWT, ~1h) for Realtime and RLS-scoped reads.
// The refresh token never leaves the HTTP-only cookie.
export async function getBrowserToken(): Promise<BrowserToken | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getSession()
  if (await dropDeadSession(error)) return null
  const session = data.session
  if (!session?.expires_at) return null
  return { token: session.access_token, expiresAt: session.expires_at * 1000 }
}
