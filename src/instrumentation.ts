import { describeAuthError, isDeadSessionError } from '@/lib/supabase/auth-errors'

// Runs once per server process. supabase-js logs a rejected refresh token (a stale or already
// rotated session cookie) as a full stack trace, once per request, from its INITIAL_SESSION
// listener. The proxy already handles it (clears the cookies, src/lib/supabase/proxy.ts), so
// those expected errors become one line; every other log passes through untouched.
export function register() {
  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      if (args.length === 1 && isDeadSessionError(args[0])) {
        console.info(`[auth] supabase: expected refresh failure (${describeAuthError(args[0])})`)
        return
      }
      original(...args)
    }
  }
}
