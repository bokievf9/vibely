import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'
import type { AdminRole } from '../roles'
import { maskPhone } from '../mask'

export type TeamMember = {
  userId: string
  role: AdminRole
  name: string
  username: string | null
  phone: string
  createdAt: string
}

export async function getTeam(): Promise<TeamMember[]> {
  const adminId = await requireAdmin({ min: 'owner' })
  const { data } = await createAdminClient().rpc('admin_list_team', { p_admin: adminId })
  return (data ?? []).map((m) => ({
    userId: m.user_id,
    role: m.role,
    name: m.display_name ?? 'без профиля',
    username: m.username,
    phone: maskPhone(m.phone),
    createdAt: m.created_at,
  }))
}

export type BlockedPhone = {
  id: string
  phone: string
  reason: string | null
  userId: string | null
  createdAt: string
}

export async function getBlocklist(): Promise<BlockedPhone[]> {
  await requireAdmin({ min: 'admin' })
  const { data } = await createAdminClient()
    .from('phone_blocklist')
    .select('id, phone, reason, user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  return (data ?? []).map((b) => ({
    id: b.id,
    phone: b.phone,
    reason: b.reason,
    userId: b.user_id,
    createdAt: b.created_at,
  }))
}
