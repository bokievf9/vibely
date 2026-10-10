import 'server-only'
import type { Json } from '@/types/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'

export type AdminOrder = {
  id: string
  userId: string | null
  name: string | null
  username: string | null
  plan: 'plus' | 'vip'
  periodMonths: number
  amountSen: number
  currency: string
  provider: string
  providerRef: string | null
  status: string
  createdAt: string
  paidAt: string | null
  refundedAt: string | null
  refundReason: string | null
  failureReason: string | null
}

export type PaymentStats = {
  paid: { count: number; sen: number }
  paid30d: { count: number; sen: number }
  refunded: { count: number; sen: number }
  pending: number
  failed: number
  test: number
  byPlan: Record<'plus' | 'vip', { count: number; sen: number }>
  eventsWithErrors: number
}

export type AdminPrice = {
  plan: 'plus' | 'vip'
  periodMonths: number
  amountSen: number
  active: boolean
  providerPriceId: string | null
  updatedAt: string
}

type Obj = { [key: string]: Json | undefined }
const obj = (v: Json | undefined | null): Obj =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {}
const num = (v: Json | undefined) => (typeof v === 'number' ? v : Number(v ?? 0) || 0)
const str = (v: Json | undefined) => (typeof v === 'string' ? v : null)
const plan = (v: Json | undefined): 'plus' | 'vip' => (v === 'vip' ? 'vip' : 'plus')
const pair = (v: Json | undefined) => ({ count: num(obj(v).count), sen: num(obj(v).sen) })

export function parseOrders(data: Json | null): AdminOrder[] {
  return (Array.isArray(data) ? data : []).map((row) => {
    const o = obj(row)
    return {
      id: str(o.id) ?? '',
      userId: str(o.user_id),
      name: str(o.name),
      username: str(o.username),
      plan: plan(o.plan),
      periodMonths: num(o.period_months),
      amountSen: num(o.amount_sen),
      currency: str(o.currency) ?? 'MYR',
      provider: str(o.provider) ?? '',
      providerRef: str(o.provider_ref),
      status: str(o.status) ?? '',
      createdAt: str(o.created_at) ?? '',
      paidAt: str(o.paid_at),
      refundedAt: str(o.refunded_at),
      refundReason: str(o.refund_reason),
      failureReason: str(o.failure_reason),
    }
  })
}

// Null when the payments migration (20261011000100) is not applied yet.
export async function getPaymentStats(): Promise<PaymentStats | null> {
  const adminId = await requireAdmin({ min: 'admin' })
  const { data, error } = await createAdminClient().rpc('admin_payment_stats', {
    p_admin: adminId,
  })
  if (error) return null
  const s = obj(data)
  const byPlan = obj(s.by_plan)
  return {
    paid: pair(s.paid),
    paid30d: pair(s.paid_30d),
    refunded: pair(s.refunded),
    pending: num(s.pending),
    failed: num(s.failed),
    test: num(s.test),
    byPlan: { plus: pair(byPlan.plus), vip: pair(byPlan.vip) },
    eventsWithErrors: num(s.events_with_errors),
  }
}

export async function getRecentOrders(): Promise<AdminOrder[]> {
  const adminId = await requireAdmin({ min: 'admin' })
  const { data, error } = await createAdminClient().rpc('admin_payment_orders', {
    p_admin: adminId,
    p_limit: 50,
  })
  return error ? [] : parseOrders(data)
}

export async function getAdminPrices(): Promise<AdminPrice[]> {
  const adminId = await requireAdmin({ min: 'admin' })
  const { data, error } = await createAdminClient().rpc('admin_plan_prices', { p_admin: adminId })
  if (error || !Array.isArray(data)) return []
  return data.map((row) => {
    const o = obj(row)
    return {
      plan: plan(o.plan),
      periodMonths: num(o.period_months),
      amountSen: num(o.amount_sen),
      active: o.active === true,
      providerPriceId: str(o.provider_price_id),
      updatedAt: str(o.updated_at) ?? '',
    }
  })
}
