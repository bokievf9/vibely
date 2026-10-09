'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAdminAction } from './run-action'

const reviewDuoBioSchema = z.object({
  teamId: z.uuid(),
  approve: z.boolean(),
  reason: z.string().trim().max(500).optional(),
})

// /admin/duo: approve a held duo bio (shown to other duos) or reject it (bio removed).
// Moderator and up; the RPC re-checks the role and logs duo_bio.approve / duo_bio.reject.
export async function reviewDuoBio(input: z.input<typeof reviewDuoBioSchema>) {
  return runAdminAction(reviewDuoBioSchema, input, 'moderator', async (d, admin) =>
    createAdminClient().rpc('admin_review_duo_bio', {
      p_admin: admin.id,
      p_team: d.teamId,
      p_approve: d.approve,
      p_reason: d.reason || undefined,
    }),
  )
}
