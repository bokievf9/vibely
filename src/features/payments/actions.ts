'use server'

import { z } from 'zod'
import type { Json } from '@/types/database.types'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { publicEnv } from '@/lib/env'
import { fail, ok, type UserResult } from '@/i18n/errors'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { getActionLocale } from '@/i18n/server'
import { localePath } from '@/i18n/config'
import { getViewer } from '@/features/auth/session'
import { BILLING_MONTHS, BILLING_PERIODS } from '@/features/plans/pricing'
import { processPaymentEvent } from './process'
import { testEvent } from './providers/test'
import { getCheckoutMode, parsePayments } from './queries'
import { providerFor } from './registry'
import type { OrderStatus, PaidPlan, PeriodMonths } from './types'

const checkoutSchema = z.object({
  plan: z.enum(['plus', 'vip']),
  period: z.enum(BILLING_PERIODS),
})

type Obj = { [key: string]: Json | undefined }
const obj = (v: Json | null | undefined): Obj =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {}
const str = (v: Json | undefined) => (typeof v === 'string' ? v : null)

function orderError(code: string | undefined): ErrorKey {
  if (code === 'P0429') return 'rateLimited'
  if (code === 'P0002') return 'priceUnavailable'
  if (code === '42501') return 'unauthorized'
  if (code === 'PGRST202' || code === '42883') return 'paymentsUnavailable'
  return 'checkoutFailed'
}

// "Get Plus" / "Get VIP": creates (or reuses) the pending order and returns where to send the
// browser: the gateway's checkout, or the in-app test checkout. Signed-in verified users only;
// checkout must be open to the viewer (payments enabled, or test mode for staff). The amount is
// taken from plan_prices in the database, never from the client. Rate limited in the database
// (5 new orders per 10 minutes; reusing the pending order does not count).
export async function startCheckout(input: {
  plan: PaidPlan
  period: (typeof BILLING_PERIODS)[number]
}): Promise<UserResult<{ redirectUrl: string }>> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer?.profile || viewer.profile.banReason) return fail('unauthorized')
  if (viewer.profile.verificationStatus !== 'approved') return fail('unauthorized')

  const mode = await getCheckoutMode()
  const provider = providerFor(mode)
  if (!provider) return fail('paymentsUnavailable')

  const months = BILLING_MONTHS[parsed.data.period] as PeriodMonths
  const db = createAdminClient()
  const { data, error } = await db.rpc('payment_create_order', {
    p_user: viewer.id,
    p_plan: parsed.data.plan,
    p_period: months,
    p_provider: provider.id,
  })
  if (error || !data) return fail(orderError(error?.code))
  const order = obj(data)
  const orderId = str(order.id)
  if (!orderId) return fail('checkoutFailed')
  const existing = str(order.checkout_url)
  if (order.reused === true && existing) return ok({ redirectUrl: existing })

  const { data: price } = await db
    .from('plan_prices')
    .select('provider_price_id')
    .eq('plan', parsed.data.plan)
    .eq('period_months', months)
    .maybeSingle()
  const locale = await getActionLocale()
  const site = publicEnv.NEXT_PUBLIC_SITE_URL
  try {
    const checkout = await provider.createCheckout(
      {
        id: orderId,
        userId: viewer.id,
        plan: parsed.data.plan,
        periodMonths: months,
        amountSen: Number(order.amount_sen),
        currency: 'MYR',
      },
      {
        returnUrl: new URL(localePath(locale, `/plans/return?order=${orderId}`), site).toString(),
        webhookUrl: new URL(`/api/payments/webhook/${provider.id}`, site).toString(),
        locale,
        providerPriceId: price?.provider_price_id ?? null,
      },
    )
    const { error: attachError } = await db.rpc('payment_attach_checkout', {
      p_order: orderId,
      p_provider_ref: checkout.providerRef,
      p_checkout_url: checkout.redirectUrl,
    })
    if (attachError) return fail('checkoutFailed')
    return ok({ redirectUrl: checkout.redirectUrl })
  } catch (e) {
    console.error('[payments] checkout failed:', e instanceof Error ? e.message : 'error')
    return fail('checkoutFailed')
  }
}

const orderIdSchema = z.uuid()

// The return page polls this: the order's status as the database has it (only the webhook path
// changes it). Own orders only (my_payments).
export async function getOrderStatus(
  orderId: string,
): Promise<UserResult<{ status: OrderStatus; plan: PaidPlan } | null>> {
  if (!orderIdSchema.safeParse(orderId).success) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_payments', { p_id: orderId })
  if (error) return fail('generic')
  const [order] = parsePayments(data)
  return ok(order ? { status: order.status, plan: order.plan } : null)
}

// The test checkout's "Pay (test)" / "Fail (test)": staff in test mode, own pending test orders
// only. Fires the same handler a verified webhook does.
export async function completeTestCheckout(
  orderId: string,
  outcome: 'paid' | 'failed',
): Promise<UserResult<OrderStatus>> {
  if (!orderIdSchema.safeParse(orderId).success) return fail('invalidInput')
  if (outcome !== 'paid' && outcome !== 'failed') return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  if ((await getCheckoutMode()).kind !== 'test') return fail('paymentsUnavailable')

  const db = createAdminClient()
  const { data } = await db.rpc('payment_order', { p_order: orderId, p_user: viewer.id })
  const order = obj(data)
  if (str(order.provider) !== 'test' || str(order.status) !== 'pending') return fail('invalidInput')

  const result = await processPaymentEvent(
    testEvent(
      { id: orderId, amountSen: Number(order.amount_sen), currency: str(order.currency) ?? 'MYR' },
      outcome,
      crypto.randomUUID(),
    ),
  )
  if (!result.recorded || result.error) return fail('generic')
  const { data: after } = await db.rpc('payment_order', { p_order: orderId, p_user: viewer.id })
  const status = str(obj(after).status)
  return ok((status ?? 'pending') as OrderStatus)
}
