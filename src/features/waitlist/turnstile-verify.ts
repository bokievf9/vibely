// Cloudflare Turnstile server-side check (siteverify). Pure: the caller passes the secret, so this
// file has no env access and can be unit tested with a fake fetch.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export type TurnstileOutcome = 'skipped' | 'passed' | 'failed'

type Input = {
  // Absent: verification is off (no TURNSTILE_SECRET_KEY), the database rate limits still apply.
  secret: string | null | undefined
  token: string | null | undefined
  ip?: string | null
  // The action the widget was rendered with; a token from another form is refused.
  action?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export async function verifyTurnstile({
  secret,
  token,
  ip,
  action,
  fetchImpl = fetch,
  timeoutMs = 5000,
}: Input): Promise<TurnstileOutcome> {
  if (!secret) return 'skipped'
  if (!token || token.length > 2048) return 'failed'
  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)
  try {
    const res = await fetchImpl(SITEVERIFY, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return 'failed'
    const data = (await res.json()) as { success?: boolean; action?: string }
    if (data.success !== true) return 'failed'
    if (action && data.action && data.action !== action) return 'failed'
    return 'passed'
  } catch {
    // Cloudflare unreachable: fail closed, the visitor can retry.
    return 'failed'
  }
}
