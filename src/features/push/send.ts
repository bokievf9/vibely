import 'server-only'
import { after } from 'next/server'
import { sendNotification, WebPushError } from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPushEnv } from '@/lib/env.server'
import { DEFAULT_LOCALE, fmt, hasLocale, localePath, type Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/server'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { LIKES_VISIBLE_FREE } from '@/features/likes/config'
import type { NotificationType } from './prefs'
import type { PushPayload } from './types'

type Build = (dict: Dictionary, locale: Locale) => PushPayload

const DAY = 24 * 60 * 60

// Sends to every device of a user, each in the language it subscribed with, unless the user
// turned this notification type off (Settings → Notifications; no prefs row = everything on).
// Expired subscriptions (404/410 from the push service) are removed.
export async function sendToUser(
  userId: string,
  type: NotificationType,
  build: Build,
): Promise<void> {
  const env = getPushEnv()
  if (!env) return
  const admin = createAdminClient()
  const [{ data, error }, { data: prefs }] = await Promise.all([
    admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, locale')
      .eq('user_id', userId),
    admin.from('notification_prefs').select('*').eq('user_id', userId).maybeSingle(),
  ])
  if (error) throw new Error(`push: could not load subscriptions: ${error.message}`)
  if (prefs?.[type] === false || !data.length) return

  const vapidDetails = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  }
  const expired: string[] = []
  await Promise.all(
    data.map(async (sub) => {
      const locale = hasLocale(sub.locale) ? sub.locale : DEFAULT_LOCALE
      const payload = build(await getDictionary(locale), locale)
      try {
        await sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { vapidDetails, TTL: DAY, urgency: 'high', timeout: 10_000 },
        )
      } catch (e) {
        if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) {
          expired.push(sub.id)
        } else {
          console.error('[push] send failed', e instanceof WebPushError ? e.statusCode : e)
        }
      }
    }),
  )
  if (expired.length) await admin.from('push_subscriptions').delete().in('id', expired)
}

// Runs after the Server Action has responded: never delays or fails the user's action.
function inBackground(task: () => Promise<void>) {
  if (!getPushEnv()) return
  after(async () => {
    try {
      await task()
    } catch (e) {
      console.error('[push]', e)
    }
  })
}

const chatUrl = (locale: Locale, matchId: string) => localePath(locale, `/chats/${matchId}`)

export function notifyNewMatch(userId: string, partnerName: string, matchId: string) {
  inBackground(() =>
    sendToUser(userId, 'new_matches', (dict, locale) => ({
      title: dict.push.newMatch,
      body: fmt(dict.push.newMatchBody, { name: partnerName }),
      url: chatUrl(locale, matchId),
      tag: `match-${matchId}`,
    })),
  )
}

// Looks up the recipient and sender name in the background, so sending a message stays fast.
// Callers must have authorized the sender for this match (the RLS-checked insert did).
export function notifyNewMessage(matchId: string, senderId: string, kind: 'text' | 'photo') {
  inBackground(async () => {
    const admin = createAdminClient()
    const { data: match } = await admin
      .from('matches')
      .select('user_a, user_b')
      .eq('id', matchId)
      .maybeSingle()
    if (!match) return
    const recipient = match.user_a === senderId ? match.user_b : match.user_a
    const { data: sender } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', senderId)
      .maybeSingle()
    // Never the message body or photo: it would be readable on a locked screen.
    await sendToUser(recipient, 'messages', (dict, locale) => ({
      title: fmt(dict.push.newMessage, { name: sender?.display_name ?? 'Vibely' }),
      body: kind === 'photo' ? dict.push.newPhotoBody : dict.push.newMessageBody,
      url: chatUrl(locale, matchId),
      tag: `chat-${matchId}`,
    }))
  })
}

export function notifyRandomReveal(userId: string, matchId: string | null) {
  inBackground(() =>
    sendToUser(userId, 'random_reveal', (dict, locale) => ({
      title: dict.push.randomReveal,
      body: dict.push.randomRevealBody,
      url: matchId ? chatUrl(locale, matchId) : localePath(locale, '/randomizer'),
      tag: `reveal-${matchId ?? userId}`,
    })),
  )
}

// A one-way like. Never the liker's name or photo: only that someone did. Skipped when the liker
// is paused, because the recipient could not find them in "Who liked you" anyway.
// One notification at a time (same tag): a burst of likes doesn't flood the lock screen.
export function notifyNewLike(userId: string, likerId: string) {
  inBackground(async () => {
    const { data: liker } = await createAdminClient()
      .from('profiles')
      .select('discoverable')
      .eq('id', likerId)
      .maybeSingle()
    if (!liker?.discoverable) return
    await sendToUser(userId, 'likes', (dict, locale) => ({
      title: dict.likes.pushTitle,
      body: LIKES_VISIBLE_FREE ? dict.likes.pushBody : dict.likes.pushBodyLocked,
      url: localePath(locale, LIKES_VISIBLE_FREE ? '/likes' : '/swipe'),
      tag: 'likes',
    }))
  })
}

// Someone commented on the recipient's anonymous post. Never the comment text or who wrote it.
export function notifyFeedReply(commentId: string) {
  inBackground(async () => {
    const { data: comment } = await createAdminClient()
      .from('comments')
      .select('post_id, author_id, posts(author_id)')
      .eq('id', commentId)
      .maybeSingle()
    const postAuthor = comment?.posts?.author_id
    if (!comment || !postAuthor || postAuthor === comment.author_id) return
    await sendToUser(postAuthor, 'feed_replies', (dict, locale) => ({
      title: dict.settings.feedReplyPush,
      body: dict.settings.feedReplyPushBody,
      url: localePath(locale, `/feed/${comment.post_id}`),
      tag: `feed-${comment.post_id}`,
    }))
  })
}
