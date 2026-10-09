'use server'

import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { maskPhone } from './mask'
import { promoIdSchema, setPromoActiveSchema, upsertPromoSchema } from './promo-schemas'
import { runAdminAction } from './run-action'

// Promo codes (/admin/promo), admin role. The RPCs normalise the code, validate the perks and
// log every change (promo.create / promo.update / promo.activate / promo.deactivate).

export async function upsertPromo(input: z.input<typeof upsertPromoSchema>) {
  return runAdminAction(upsertPromoSchema, input, 'admin', async (d, admin) => {
    const { data, error } = await createAdminClient().rpc('admin_upsert_promo', {
      p_admin: admin.id,
      p_id: d.id,
      p_code: d.code,
      p_max_uses: d.maxUses,
      p_expires_at: d.expiresAt,
      // New shape only (20261009000280): {plan, days} and/or {boost_hours}.
      p_benefits: {
        ...(d.benefits.plan ? { plan: d.benefits.plan, days: d.benefits.days } : {}),
        ...(d.benefits.boostHours > 0 ? { boost_hours: d.benefits.boostHours } : {}),
      },
      p_gender: d.gender,
      p_requires_verified: d.requiresVerified,
    })
    if (error?.code === '23505') return { error: { message: 'такой код уже есть' } }
    if (error?.code === '23514') return { error: { message: 'код или бонусы не прошли проверку' } }
    return { error, data: data as string }
  })
}

export async function setPromoActive(input: z.input<typeof setPromoActiveSchema>) {
  return runAdminAction(setPromoActiveSchema, input, 'admin', async (d, admin) =>
    createAdminClient().rpc('admin_set_promo_active', {
      p_admin: admin.id,
      p_id: d.id,
      p_active: d.active,
    }),
  )
}

const csvCell = (v: string | null) => {
  const s = v ?? ''
  // Quotes always; a leading = + - @ is neutralised so spreadsheets don't run it as a formula.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${safe.replaceAll('"', '""')}"`
}

// CSV of one code's redemptions. Phones are masked like in the panel: the export never carries
// full numbers (those are revealed and logged on the user page only).
export async function exportPromoRedemptions(input: z.input<typeof promoIdSchema>) {
  return runAdminAction(promoIdSchema, input, 'admin', async (d, admin) => {
    const db = createAdminClient()
    const [{ data: codes, error: codesError }, { data: rows, error }] = await Promise.all([
      db.rpc('admin_promo_stats', { p_admin: admin.id }),
      db.rpc('admin_promo_redemptions', { p_admin: admin.id, p_code: d.id }),
    ])
    if (codesError) return { error: codesError }
    if (error) return { error }
    const code = codes.find((c) => c.id === d.id)?.code ?? 'promo'
    const header = [
      'code',
      'redeemed_at',
      'granted_at',
      'status',
      'username',
      'display_name',
      'phone_masked',
      'user_id',
    ]
    const lines = rows.map((r) =>
      [
        code,
        r.redeemed_at,
        r.granted_at,
        r.granted_at ? 'granted' : 'pending',
        r.username,
        r.display_name,
        maskPhone(r.phone),
        r.user_id,
      ]
        .map(csvCell)
        .join(','),
    )
    return {
      error: null,
      data: {
        filename: `vibely-promo-${code.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
        // BOM so Excel opens the Cyrillic text as UTF-8.
        csv: '﻿' + [header.join(','), ...lines].join('\r\n'),
      },
    }
  })
}
