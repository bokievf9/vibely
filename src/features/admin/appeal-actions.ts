'use server'

import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAdminAction } from './run-action'
import { decideAppealSchema } from './sanction-schemas'

// /admin/appeals: accepting lifts the ban (admin), rejecting needs a note (moderator). Logged.
export async function decideAppeal(input: z.input<typeof decideAppealSchema>) {
  const parsed = decideAppealSchema.safeParse(input)
  const min = parsed.success && parsed.data.accept ? 'admin' : 'moderator'
  return runAdminAction(decideAppealSchema, input, min, async (d, admin) =>
    createAdminClient().rpc('admin_decide_appeal', {
      p_admin: admin.id,
      p_appeal: d.appealId,
      p_accept: d.accept,
      p_note: d.note || undefined,
    }),
  )
}
