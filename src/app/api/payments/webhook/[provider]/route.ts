import { getPaymentConfig } from '@/features/payments/queries'
import { processPaymentEvent } from '@/features/payments/process'
import { WebhookVerificationError } from '@/features/payments/types'

const NO_STORE = { 'Cache-Control': 'no-store' }
const MAX_BODY = 64 * 1024

// Gateway notifications: POST /api/payments/webhook/<provider>. Excluded from src/proxy.ts (no
// session, no locale). Only the configured gateway (PAYMENT_PROVIDER) is accepted, whether or
// not checkout is currently open, so payments already started are still settled. The adapter
// verifies the signature over the raw body (401 when wrong); the event is then recorded in
// payment_events before anything else and applied idempotently. Answers:
//   200 once the event is durably recorded (processed, duplicate, or refused for good, e.g. an
//       amount mismatch: retrying would not change it; admins see the error in the panel);
//   500 when it could not be recorded or the failure may be temporary: the gateway retries.
// The test gateway never accepts webhooks (its checkout calls the same handler in-app).
export async function POST(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params
  const provider = getPaymentConfig().live
  if (!provider || provider.id !== id) {
    return Response.json({ ok: false }, { status: 404, headers: NO_STORE })
  }

  const rawBody = await request.text()
  if (rawBody.length > MAX_BODY) {
    return Response.json({ ok: false }, { status: 413, headers: NO_STORE })
  }

  let event
  try {
    event = await provider.verifyWebhook({ rawBody, headers: request.headers })
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      return Response.json({ ok: false }, { status: 401, headers: NO_STORE })
    }
    console.error(
      `[payments] ${id} webhook parse failed:`,
      e instanceof Error ? e.message : 'error',
    )
    return Response.json({ ok: false }, { status: 400, headers: NO_STORE })
  }
  if (event.provider !== provider.id) {
    return Response.json({ ok: false }, { status: 400, headers: NO_STORE })
  }

  const result = await processPaymentEvent(event)
  if (!result.recorded || result.retry) {
    return Response.json({ ok: false }, { status: 500, headers: NO_STORE })
  }
  return Response.json({ ok: true }, { headers: NO_STORE })
}
