'use server'

import type { z } from 'zod'
import type { Json } from '@/types/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  grantPlanSchema,
  lookupUserSchema,
  revokeGrantSchema,
  setFeatureSchema,
  setLimitSchema,
  type PlanLevel,
} from './plans-schemas'
import { runAdminAction } from './run-action'

// Plans (/admin/plans), admin role. The RPCs check the role again and log every change.

export async function setFeature(input: z.input<typeof setFeatureSchema>) {
  return runAdminAction(setFeatureSchema, input, 'admin', async (d, admin) =>
    createAdminClient().rpc('admin_set_feature', {
      p_admin: admin.id,
      p_key: d.key,
      p_enabled: d.enabled,
      p_min_plan: d.minPlan,
      p_note: d.note || null,
    }),
  )
}

export async function setLimit(input: z.input<typeof setLimitSchema>) {
  return runAdminAction(setLimitSchema, input, 'admin', async (d, admin) =>
    createAdminClient().rpc('admin_set_limit', {
      p_admin: admin.id,
      p_key: d.key,
      p_plan: d.plan,
      p_value: d.value,
      p_period: d.period,
    }),
  )
}

export type UserPlanGrant = {
  id: string
  plan: PlanLevel
  source: string
  startsAt: string
  endsAt: string | null
  note: string | null
  revokedAt: string | null
  createdAt: string
  active: boolean
}

export type UserPlan = {
  userId: string
  name: string
  username: string | null
  plan: PlanLevel
  isStaff: boolean
  planUntil: string | null
  grants: UserPlanGrant[]
}

type Obj = { [key: string]: Json | undefined }
const obj = (v: Json | undefined): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
const str = (v: Json | undefined) => (typeof v === 'string' ? v : null)
const level = (v: Json | undefined): PlanLevel => (v === 'plus' || v === 'vip' ? v : 'free')

async function loadUserPlan(adminId: string, userId: string) {
  const db = createAdminClient()
  const [{ data, error }, { data: profile }] = await Promise.all([
    db.rpc('admin_user_plan', { p_admin: adminId, p_user: userId }),
    db.from('profiles').select('display_name, username').eq('id', userId).maybeSingle(),
  ])
  if (error) return { error }
  const u = obj(data)
  const result: UserPlan = {
    userId,
    name: profile?.display_name ?? 'без профиля',
    username: profile?.username ?? null,
    plan: level(u.plan),
    isStaff: u.is_staff === true,
    planUntil: str(u.plan_until),
    grants: (Array.isArray(u.grants) ? u.grants : []).map((g) => {
      const o = obj(g)
      return {
        id: str(o.id) ?? '',
        plan: level(o.plan),
        source: str(o.source) ?? '',
        startsAt: str(o.starts_at) ?? '',
        endsAt: str(o.ends_at),
        note: str(o.note),
        revokedAt: str(o.revoked_at),
        createdAt: str(o.created_at) ?? '',
        active: o.active === true,
      }
    }),
  }
  return { error: null, data: result }
}

// Finds a user by @username, phone or id and returns their plan and grants.
export async function lookupUserPlan(input: z.input<typeof lookupUserSchema>) {
  return runAdminAction(lookupUserSchema, input, 'admin', async (d, admin) => {
    const { data: userId, error } = await createAdminClient().rpc('admin_resolve_user', {
      p_admin: admin.id,
      p_query: d.query.replace(/^@/, ''),
    })
    if (error) return { error }
    if (!userId) return { error: { message: 'аккаунт не найден' } }
    return loadUserPlan(admin.id, userId)
  })
}

export async function grantPlan(input: z.input<typeof grantPlanSchema>) {
  return runAdminAction(grantPlanSchema, input, 'admin', async (d, admin) => {
    const { error } = await createAdminClient().rpc('admin_grant_plan', {
      p_admin: admin.id,
      p_user: d.userId,
      p_plan: d.plan,
      p_days: d.days,
      p_note: d.note || null,
    })
    if (error) return { error }
    return loadUserPlan(admin.id, d.userId)
  })
}

export async function revokeGrant(input: z.input<typeof revokeGrantSchema>) {
  return runAdminAction(revokeGrantSchema, input, 'admin', async (d, admin) => {
    const { error } = await createAdminClient().rpc('admin_revoke_grant', {
      p_admin: admin.id,
      p_id: d.id,
    })
    if (error) return { error }
    return loadUserPlan(admin.id, d.userId)
  })
}
