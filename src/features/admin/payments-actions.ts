'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProvider } from '@/features/payments/registry'
import { parseOrders, type AdminOrder } from './queries/payments'
import { runAdminAction } from './run-action'

// Payments in /admin/plans. Orders and refunds: admin role; prices: owner (money). The RPCs
// check the role again and log every change in the journal.

const STATUSES = ['pending', 'paid', 'failed', 'refunded', 'cancelled', 'expired'] as const

const listSchema = z.object({ status: z.enum(STATUSES).nullable() })

export async function listOrders(input: z.input<typeof listSchema>) {
  return runAdminAction(listSchema, input, 'admin', async (d, admin) => {
    const { data, error } = await createAdminClient().rpc('admin_payment_orders', {
      p_admin: admin.id,
      p_status: d.status,
      p_limit: 100,
    })
    if (error) return { error }
    return { error: null, data: parseOrders(data) as AdminOrder[] }
  })
}

const refundSchema = z.object({
  orderId: z.uuid(),
  reason: z.string().trim().max(500, 'Причина: не длиннее 500 символов'),
})

// Refunds a paid order in full: first at the gateway (when its adapter can refund), then in the
// database (the purchase grant is revoked, the unused time goes back to queued grants). Without a
// gateway refund the admin has already returned the money in the gateway's dashboard.
export async function refundOrder(input: z.input<typeof refundSchema>) {
  return runAdminAction(refundSchema, input, 'admin', async (d, admin) => {
    const db = createAdminClient()
    const { data: order, error } = await db
      .from('payment_orders')
      .select('id, status, provider, provider_ref, amount_sen')
      .eq('id', d.orderId)
      .maybeSingle()
    if (error) return { error }
    if (!order) return { error: { message: 'заказ не найден', code: 'P0002' } }
    if (order.status !== 'paid')
      return { error: { message: 'возврат возможен только для оплаченного заказа' } }
    const provider = getProvider(order.provider)
    if (provider?.refund && order.provider_ref) {
      try {
        await provider.refund({
          id: order.id,
          providerRef: order.provider_ref,
          amountSen: order.amount_sen,
        })
      } catch (e) {
        return {
          error: {
            message: `платёжная система отклонила возврат (${e instanceof Error ? e.message : 'ошибка'})`,
          },
        }
      }
    }
    const { error: refundError } = await db.rpc('payment_refund', {
      p_admin: admin.id,
      p_order: d.orderId,
      p_reason: d.reason || null,
    })
    return { error: refundError }
  })
}

const priceSchema = z.object({
  plan: z.enum(['plus', 'vip']),
  periodMonths: z.union([z.literal(1), z.literal(3), z.literal(12)]),
  // Ringgit, e.g. 29.90; null removes the price.
  amountRm: z
    .number('Сумма: число в ринггитах')
    .min(1, 'Сумма: от RM 1')
    .max(100000, 'Сумма: до RM 100 000')
    .nullable(),
  active: z.boolean(),
  providerPriceId: z.string().trim().max(200).nullable(),
})

export async function setPrice(input: z.input<typeof priceSchema>) {
  return runAdminAction(priceSchema, input, 'owner', async (d, admin) => {
    const { error } = await createAdminClient().rpc('admin_set_price', {
      p_admin: admin.id,
      p_plan: d.plan,
      p_period: d.periodMonths,
      p_amount_sen: d.amountRm === null ? null : Math.round(d.amountRm * 100),
      p_active: d.active,
      p_provider_price_id: d.providerPriceId || null,
    })
    return { error }
  })
}
