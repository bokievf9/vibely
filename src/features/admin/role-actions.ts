'use server'

import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAdminAction } from './run-action'
import { memberRoleSchema, memberSchema, removeMemberSchema } from './sanction-schemas'

// Team management (/admin/team), owner only. The RPCs keep at least one owner and log every change.

export async function addMember(input: z.input<typeof memberSchema>) {
  return runAdminAction(memberSchema, input, 'owner', async (d, admin) => {
    const db = createAdminClient()
    const { data: userId, error } = await db.rpc('admin_resolve_user', {
      p_admin: admin.id,
      p_query: d.query,
    })
    if (error) return { error }
    if (!userId) return { error: { message: 'аккаунт не найден' } }
    return db.rpc('admin_set_member_role', { p_admin: admin.id, p_user: userId, p_role: d.role })
  })
}

export async function setMemberRole(input: z.input<typeof memberRoleSchema>) {
  return runAdminAction(memberRoleSchema, input, 'owner', async (d, admin) =>
    createAdminClient().rpc('admin_set_member_role', {
      p_admin: admin.id,
      p_user: d.userId,
      p_role: d.role,
    }),
  )
}

export async function removeMember(input: z.input<typeof removeMemberSchema>) {
  return runAdminAction(removeMemberSchema, input, 'owner', async (d, admin) =>
    createAdminClient().rpc('admin_remove_member', { p_admin: admin.id, p_user: d.userId }),
  )
}
