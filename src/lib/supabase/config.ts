import type { CookieOptionsWithName } from '@supabase/ssr'

// Session tokens live in HTTP-only cookies: browser JS can never read the refresh token.
// Realtime gets a short-lived access token through `getRealtimeToken` instead.
export const authCookieOptions: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
}
