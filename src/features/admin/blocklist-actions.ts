'use server'

import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAdminAction } from './run-action'
import { blockPhoneSchema, unblockPhoneSchema } from './sanction-schemas'

// Phone blocklist (/admin/blocklist), admin only. Blocked numbers can't sign up again: the
// before-user-created auth hook checks the list (20261009000153).
export async function blockPhone(input: z.input<typeof blockPhoneSchema>) {
  return runAdminAction(blockPhoneSchema, input, 'admin', async (d, admin) =>
    createAdminClient().rpc('admin_block_phone', {
      p_admin: admin.id,
      p_phone: d.phone,
      p_reason: d.reason || undefined,
    }),
  )
}

export async function unblockPhone(input: z.input<typeof unblockPhoneSchema>) {
  return runAdminAction(unblockPhoneSchema, input, 'admin', async (d, admin) =>
    createAdminClient().rpc('admin_unblock_phone', {
      p_admin: admin.id,
      p_id: d.id,
      p_reason: d.reason || undefined,
    }),
  )
}
