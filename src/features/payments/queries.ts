import 'server-only'
import { cache } from 'react'
import type { Json } from '@/types/database.types'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccess } from '@/features/plans/queries'
import {
  PAYMENTS_ENABLED,
  PLAN_PRICES,
  priceTable,
  type PriceTable,
} from '@/features/plans/pricing'
import { checkoutMode, readPaymentConfig, type CheckoutMode } from './registry'
import { isOrderStatus, type OrderStatus, type PaidPlan, type PeriodMonths } from './types'

// Server environment, read at runtime (PAYMENT_PROVIDER, PAYMENT_TEST_MODE; NODE_ENV is fixed at
// build time). See docs/payments.md.
export function getPaymentConfig() {
  return readPaymentConfig({
    NODE_ENV: process.env.NODE_ENV,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    PAYMENT_TEST_MODE: process.env.PAYMENT_TEST_MODE,
  })
}

// How the signed-in viewer may check out: live, test (staff) or off. Staff comes from my_access;
// before the plans migration it is false, so checkout stays off.
export const getCheckoutMode = cache(async (): Promise<CheckoutMode> => {
  const access = await getAccess()
  return checkoutMode(getPaymentConfig(), { isStaff: access.isStaff }, PAYMENTS_ENABLED)
})

export type CheckoutView = {
  mode: 'live' | 'test' | 'off'
  prices: PriceTable
  // Test mode: prices that are drafts (inactive), keyed "plan:months".
  drafts: string[]
}

// What the Plans screen needs: the mode and the prices to show. Off: the static PLAN_PRICES
// (nulls), exactly as before payments existed. Live: active prices. Test: every price, drafts
// marked. Any error (migration 20261011000100 not applied) falls back to off.
export const getCheckoutView = cache(async (): Promise<CheckoutView> => {
  const off: CheckoutView = { mode: 'off', prices: PLAN_PRICES, drafts: [] }
  const mode = await getCheckoutMode()
  if (mode.kind === 'off') return off
  if (mode.kind === 'live') {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('plan_prices_public')
    if (error || !data) return off
    return { mode: 'live', prices: priceTable(data), drafts: [] }
  }
  const { data, error } = await createAdminClient()
    .from('plan_prices')
    .select('plan, period_months, amount_sen, active')
  if (error || !data) return off
  const rows = data
  return {
    mode: 'test',
    prices: priceTable(rows),
    drafts: rows.filter((r) => !r.active).map((r) => `${r.plan}:${r.period_months}`),
  }
})

export type MyPayment = {
  id: string
  plan: PaidPlan
  periodMonths: PeriodMonths
  amountSen: number
  currency: string
  provider: string
  status: OrderStatus
  createdAt: string
  paidAt: string | null
  refundedAt: string | null
}

type Obj = { [key: string]: Json | undefined }
const obj = (v: Json | undefined): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
const str = (v: Json | undefined) => (typeof v === 'string' ? v : null)

export function parsePayments(data: Json | null): MyPayment[] {
  return (Array.isArray(data) ? data : []).flatMap((row) => {
    const o = obj(row)
    const months = Number(o.period_months)
    const status = o.status
    const plan = o.plan
    if ((plan !== 'plus' && plan !== 'vip') || !isOrderStatus(status)) return []
    if (months !== 1 && months !== 3 && months !== 12) return []
    return [
      {
        id: str(o.id) ?? '',
        plan,
        periodMonths: months,
        amountSen: Number(o.amount_sen) || 0,
        currency: str(o.currency) ?? 'MYR',
        provider: str(o.provider) ?? '',
        status,
        createdAt: str(o.created_at) ?? '',
        paidAt: str(o.paid_at),
        refundedAt: str(o.refunded_at),
      },
    ]
  })
}

// The viewer's orders (my_payments). Null when the function is not deployed yet.
export const getMyPayments = cache(async (): Promise<MyPayment[] | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_payments', {})
  if (error) return null
  return parsePayments(data)
})

// One of the viewer's orders, or null (not theirs, unknown, or the migration is missing).
export async function getMyOrder(orderId: string): Promise<MyPayment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_payments', { p_id: orderId })
  if (error) return null
  return parsePayments(data)[0] ?? null
}
