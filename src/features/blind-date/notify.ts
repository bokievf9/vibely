import 'server-only'
import { after } from 'next/server'
import { z } from 'zod'
import { sendToUser } from '@/features/push/send'
import { fmt, localePath } from '@/i18n/config'
import { getPushEnv } from '@/lib/env.server'
import { createAdminClient } from '@/lib/supabase/admin'

const claimSchema = z.object({
  recipient: z.uuid(),
  kind: z.enum(['post', 'prompt']),
  session_id: z.uuid(),
  sender_name: z.string().nullable(),
  is_first: z.boolean(),
})

// A message in a post / prompt conversation (20261009000220), after the Server Action has
// responded. The database decides whether to notify (never blind dates, ended sessions, blocked
// pairs; at most one push per conversation per 10 minutes) and claims the slot atomically.
// Post conversations: never a name or the text, only that someone wrote. Prompt conversations
// show names from the start, so the push names the sender like a chat message.
export function notifyConversationMessage(messageId: string) {
  if (!getPushEnv()) return
  after(async () => {
    try {
      const { data, error } = await createAdminClient().rpc('claim_session_push', {
        p_message: messageId,
      })
      if (error) throw new Error(error.message)
      const claim = claimSchema.safeParse(data)
      if (!claim.success) return
      const { recipient, kind, session_id: sessionId, sender_name: senderName, is_first } = claim.data
      const url = (locale: Parameters<typeof localePath>[0]) =>
        localePath(locale, `/blind-date/${sessionId}`)
      if (kind === 'post') {
        await sendToUser(recipient, 'post_replies', (dict, locale) => ({
          title: is_first ? dict.conversations.pushReply : dict.conversations.pushReplyMessage,
          body: is_first ? dict.conversations.pushReplyBody : dict.conversations.pushReplyMessageBody,
          url: url(locale),
          tag: `conversation-${sessionId}`,
        }))
      } else {
        await sendToUser(recipient, 'messages', (dict, locale) => ({
          title: fmt(dict.push.newMessage, { name: senderName ?? 'Vibely' }),
          body: dict.push.newMessageBody,
          url: url(locale),
          tag: `conversation-${sessionId}`,
        }))
      }
    } catch (e) {
      console.error('[push] conversation message', e)
    }
  })
}
