import 'server-only'
import { after } from 'next/server'
import { z } from 'zod'
import { sendToUser } from '@/features/push/send'
import { fmt, localePath } from '@/i18n/config'
import { getPushEnv } from '@/lib/env.server'
import { createAdminClient } from '@/lib/supabase/admin'

const claimSchema = z.object({
  recipient: z.uuid(),
  session_id: z.uuid(),
  sender_name: z.string().nullable(),
  is_first: z.boolean(),
})

// "{name} replied to your status" / "New message from {name}", after the Server Action has
// responded. The database decides whether to notify (active status conversation, not blocked,
// at most one push per conversation per 10 minutes) and claims the slot atomically. Never the
// message text.
export function notifyStatusReply(messageId: string) {
  if (!getPushEnv()) return
  after(async () => {
    try {
      const { data, error } = await createAdminClient().rpc('claim_status_push', {
        p_message: messageId,
      })
      if (error) throw new Error(error.message)
      const claim = claimSchema.safeParse(data)
      if (!claim.success) return
      const { recipient, session_id: sessionId, sender_name: name, is_first: first } = claim.data
      await sendToUser(recipient, 'status_replies', (dict, locale) => ({
        title: fmt(first ? dict.statuses.pushReply : dict.statuses.pushMessage, {
          name: name ?? 'Vibely',
        }),
        body: dict.statuses.pushBody,
        url: localePath(locale, `/statuses/${sessionId}`),
        tag: `status-${sessionId}`,
      }))
    } catch (e) {
      console.error('[push] status reply', e)
    }
  })
}
