import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type VipStatus = {
  isVip: boolean
  vipUntil: string | null
  boostUntil: string | null
  seeLikes: boolean
  queuePriority: boolean
  // Codes reserved during onboarding, waiting for the selfie check.
  pending: number
}

const myVipSchema = z.object({
  is_vip: z.boolean(),
  vip_until: z.string().nullable(),
  boost_until: z.string().nullable(),
  perks: z.object({ see_likes: z.boolean().optional(), queue_priority: z.boolean().optional() }),
  pending: z.number(),
})

// The viewer's VIP state (my_vip). Null when the RPC is not deployed yet or the viewer has no
// profile: the Settings row and the own-profile badge are then simply not shown.
export async function getVipStatus(): Promise<VipStatus | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_vip')
  if (error) return null
  const parsed = myVipSchema.safeParse(data)
  if (!parsed.success) return null
  const v = parsed.data
  return {
    isVip: v.is_vip,
    vipUntil: v.is_vip ? v.vip_until : null,
    boostUntil: v.boost_until,
    seeLikes: v.is_vip && (v.perks.see_likes ?? false),
    queuePriority: v.is_vip && (v.perks.queue_priority ?? false),
    pending: v.pending,
  }
}

// Which of these people are VIP right now (badge on cards). Empty when the RPC is missing.
export async function getVipIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('vip_ids', { p_ids: ids })
  return new Set(error ? [] : data)
}

// "Who liked you" for a VIP with the see_likes perk, when the global free flag is off.
export async function viewerCanSeeLikes(): Promise<boolean> {
  return (await getVipStatus())?.seeLikes ?? false
}

// Same check for a push recipient (no cookies: service role). False when the RPC is missing.
export async function userCanSeeLikes(userId: string): Promise<boolean> {
  const { data } = await createAdminClient().rpc('has_vip_perk', {
    p_user: userId,
    p_perk: 'see_likes',
  })
  return data === true
}
