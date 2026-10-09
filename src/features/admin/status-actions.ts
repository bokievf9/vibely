'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/types/action-result'
import { notifyReportsResolved } from '@/features/telegram/notify'
import { runAdminAction } from './run-action'

const decisionSchema = z.object({
  id: z.uuid(),
  decision: z.enum(['approve', 'remove']),
  reason: z.string().trim().max(500).optional(),
})

// /admin/statuses: approve (held -> visible) or remove (hidden everywhere). The RPC checks the
// role (moderator and up), closes the open reports on the status and logs status.approve /
// status.remove to moderation_actions.
export async function moderateStatus(input: z.input<typeof decisionSchema>): Promise<ActionResult> {
  return runAdminAction(decisionSchema, input, 'moderator', async (data, admin) => {
    const { data: result, error } = await createAdminClient().rpc('admin_moderate_status', {
      p_admin: admin.id,
      p_status: data.id,
      p_decision: data.decision,
      p_reason: data.reason || undefined,
    })
    const closed = z.object({ closed: z.number() }).safeParse(result)
    if (!error && closed.success && closed.data.closed > 0) {
      notifyReportsResolved(
        'status',
        data.id,
        admin.id,
        data.decision === 'approve' ? '✅ Статус одобрен' : '🗑 Статус удалён',
      )
    }
    return { error }
  })
}
