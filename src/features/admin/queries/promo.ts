import 'server-only'
import type { Json } from '@/types/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'
import { maskPhone } from '../mask'
import type { PromoBenefits } from '../promo-schemas'

export type PromoCode = {
  id: string
  code: string
  maxUses: number | null
  currentUses: number
  expiresAt: string | null
  benefits: PromoBenefits
  gender: 'male' | 'female' | null
  requiresVerified: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  grantedCount: number
  pendingCount: number
}

// promo_codes.benefits (jsonb) → the form shape. Unknown or missing keys read as off.
export function parseBenefits(json: Json): PromoBenefits {
  const b = json && typeof json === 'object' && !Array.isArray(json) ? json : {}
  const num = (v: Json | undefined) => (typeof v === 'number' ? v : 0)
  return {
    vipDays: num(b.vip_days),
    boostHours: num(b.boost_hours),
    seeLikes: b.see_likes === true,
    queuePriority: b.queue_priority === true,
  }
}

// All codes with usage (admin role). Null when the RPC is not deployed yet (the migration
// 20261009000230 is pending): the page says so instead of showing an empty list.
export async function getPromoCodes(): Promise<PromoCode[] | null> {
  const adminId = await requireAdmin({ min: 'admin' })
  const { data, error } = await createAdminClient().rpc('admin_promo_stats', { p_admin: adminId })
  if (error) return null
  return data.map((c) => ({
    id: c.id,
    code: c.code,
    maxUses: c.max_uses,
    currentUses: c.current_uses,
    expiresAt: c.expires_at,
    benefits: parseBenefits(c.benefits),
    gender:
      c.gender_restriction === 'male' || c.gender_restriction === 'female'
        ? c.gender_restriction
        : null,
    requiresVerified: c.requires_verified,
    isActive: c.is_active,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    grantedCount: Number(c.granted_count),
    pendingCount: Number(c.pending_count),
  }))
}

export type PromoRedemption = {
  userId: string
  name: string
  username: string | null
  // Masked ("+60 •••• 4567"): the full number is on the user page, where the reveal is logged.
  phone: string
  redeemedAt: string
  grantedAt: string | null
}

export async function getPromoRedemptions(codeId: string): Promise<PromoRedemption[]> {
  const adminId = await requireAdmin({ min: 'admin' })
  const { data } = await createAdminClient().rpc('admin_promo_redemptions', {
    p_admin: adminId,
    p_code: codeId,
  })
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    name: r.display_name ?? 'без профиля',
    username: r.username,
    phone: maskPhone(r.phone),
    redeemedAt: r.redeemed_at,
    grantedAt: r.granted_at,
  }))
}
