import 'server-only'
import { after } from 'next/server'
import { sendToUser } from '@/features/push/send'
import { localePath } from '@/i18n/config'
import { getPushEnv } from '@/lib/env.server'
import { createAdminClient } from '@/lib/supabase/admin'

// "Someone replied to your post", after the Server Action has responded. The database decides
// whether to notify (not own post, not blocked, at most one push per post per 10 minutes) and
// claims the slot atomically. Never includes the comment text or who wrote it.
export function notifyNewComment(commentId: string, postId: string) {
  if (!getPushEnv()) return
  after(async () => {
    try {
      const { data: authorId, error } = await createAdminClient().rpc('claim_comment_push', {
        p_comment_id: commentId,
      })
      if (error) throw new Error(error.message)
      if (!authorId) return
      await sendToUser(authorId, (dict, locale) => ({
        title: dict.feed.pushReply,
        body: dict.feed.pushReplyBody,
        url: localePath(locale, `/feed/${postId}`),
        tag: `post-${postId}`,
      }))
    } catch (e) {
      console.error('[push] feed reply', e)
    }
  })
}
