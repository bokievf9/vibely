// A session cookie whose refresh token Supabase no longer accepts (already rotated, revoked or
// expired) can never come back. Pure helpers (no Next/Supabase imports) so they are unit tested.

// Error codes of the token endpoint that mean the session is gone for good.
const DEAD_SESSION_CODES = new Set([
  'refresh_token_already_used',
  'refresh_token_not_found',
  'session_not_found',
  'session_expired',
])

type MaybeAuthError = { name?: unknown; code?: unknown; status?: unknown; message?: unknown }

// True for a refresh failure that will fail the same way on every retry. Network errors,
// timeouts and 5xx (AuthRetryableFetchError) never count: those must keep the session.
export function isDeadSessionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, code, status, message } = error as MaybeAuthError
  if (name === 'AuthRetryableFetchError') return false
  if (typeof code === 'string' && DEAD_SESSION_CODES.has(code)) return true
  if (typeof message === 'string' && /invalid refresh token/i.test(message)) return true
  // The token endpoint rejects a refresh with 400; older GoTrue versions send no code.
  return name === 'AuthApiError' && status === 400
}

// Supabase auth cookies: sb-<project ref>-auth-token, its chunks (.0, .1, …) and the PKCE
// code verifier (sb-<ref>-auth-token-code-verifier).
export function isAuthCookieName(name: string): boolean {
  return /^sb-[^\s;=]+-auth-token(?:-code-verifier)?(?:\.\d+)?$/.test(name)
}

// One line for the logs instead of a stack trace: the error is expected and handled.
export function describeAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error)
  const { name, code, status } = error as MaybeAuthError
  return [name, code, status].filter((v) => v !== undefined && v !== null && v !== '').join(' ')
}
