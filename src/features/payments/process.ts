import 'server-only'
import type { Json } from '@/types/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PaymentEvent } from './types'

export type ProcessResult = {
  // The event is durably stored (false: the gateway must retry).
  recorded: boolean
  duplicate: boolean
  error: string | null
  // The error may go away on its own (database down, timeout): answer 5xx so the gateway retries.
  // Business refusals (unknown order, amount mismatch, wrong state) are final: answer 200.
  retry: boolean
}

// SQLSTATEs of the payment functions that a retry cannot change.
const FINAL_CODES = new Set(['P0002', 'VP422', 'VP409', '22023'])

// The one handler behind every gateway notification (the webhook route) and the test checkout:
//   1. record the verified event (unique per provider + event id): durable before anything else;
//      a re-delivery stops here (duplicate);
//   2. apply it to the order (payment_mark_paid / _failed / _refunded, all idempotent);
//   3. store the outcome on the event (error text for admins, e.g. an amount mismatch).
// A failed or unfinished event is processed again on re-delivery (the functions are idempotent).
// The client's own "success" redirect is never trusted: only this path changes an order.
export async function processPaymentEvent(event: PaymentEvent): Promise<ProcessResult> {
  const db = createAdminClient()
  const { data: eventRow, error: recordError } = await db.rpc('payment_record_event', {
    p_provider: event.provider,
    p_event_id: event.eventId.slice(0, 200),
    p_type: event.type,
    p_provider_ref: event.providerRef,
    p_amount_sen: event.amountSen,
    p_currency: event.currency,
    p_payload: event.payload as Json,
  })
  if (recordError)
    return { recorded: false, duplicate: false, error: recordError.message, retry: true }
  if (!eventRow) return { recorded: true, duplicate: true, error: null, retry: false }

  let error: string | null = null
  let retry = false
  if (event.type !== 'ignored') {
    if (!event.providerRef) {
      error = 'no provider reference'
    } else {
      const ref = { p_provider: event.provider, p_provider_ref: event.providerRef }
      const snapshot = event.payload as Json
      const result =
        event.type === 'paid'
          ? await db.rpc('payment_mark_paid', {
              ...ref,
              p_amount_sen: event.amountSen ?? -1,
              p_currency: event.currency ?? '',
              p_event: snapshot,
            })
          : event.type === 'refunded'
            ? await db.rpc('payment_mark_refunded', { ...ref, p_event: snapshot })
            : await db.rpc('payment_mark_failed', {
                ...ref,
                p_status: event.type,
                p_reason: event.reason ?? null,
                p_event: snapshot,
              })
      if (result.error) {
        retry = !FINAL_CODES.has(result.error.code)
        error = [result.error.code, result.error.message, result.error.details]
          .filter(Boolean)
          .join(': ')
      }
    }
  }
  await db.rpc('payment_finish_event', { p_event: eventRow, p_error: error })
  if (error) console.error(`[payments] ${event.provider} event ${event.type} failed: ${error}`)
  return { recorded: true, duplicate: false, error, retry }
}
