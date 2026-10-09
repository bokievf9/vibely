import 'server-only'
import { after } from 'next/server'
import { sendNotification, WebPushError } from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPushEnv } from '@/lib/env.server'
import { DEFAULT_LOCALE, fmt, hasLocale, localePath, type Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/server'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { LIKES_VISIBLE_FREE } from '@/features/likes/config'
import { userCanSeeLikes } from '@/features/promo/queries'
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
  options: { ttl?: number } = {},
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
          { vapidDetails, TTL: options.ttl ?? DAY, urgency: 'high', timeout: 10_000 },
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
const MESSAGE_BODY = {
  text: (dict: Dictionary) => dict.push.newMessageBody,
  photo: (dict: Dictionary) => dict.push.newPhotoBody,
  voice: (dict: Dictionary) => dict.media.pushVoice,
  video: (dict: Dictionary) => dict.media.pushVideo,
}

export function notifyNewMessage(
  matchId: string,
  senderId: string,
  kind: keyof typeof MESSAGE_BODY,
) {
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
    // Never the message body or media: it would be readable on a locked screen.
    await sendToUser(recipient, 'messages', (dict, locale) => ({
      title: fmt(dict.push.newMessage, { name: sender?.display_name ?? 'Vibely' }),
      body: MESSAGE_BODY[kind](dict),
      url: chatUrl(locale, matchId),
      tag: `chat-${matchId}`,
    }))
  })
}

// Both people pressed Connect on a blind date. Sent to the one who connected first (the other
// is the one who just completed it). Preference key stays 'random_reveal' (DB column).
export function notifyBlindMatch(userId: string, matchId: string | null) {
  inBackground(() =>
    sendToUser(userId, 'random_reveal', (dict, locale) => ({
      title: dict.push.randomReveal,
      body: dict.push.randomRevealBody,
      url: matchId ? chatUrl(locale, matchId) : localePath(locale, '/blind-date'),
      tag: `reveal-${matchId ?? userId}`,
    })),
  )
}

// Blind Dating Night reminders for people who tapped "Remind me": 15 minutes before the start
// and when it goes live (POST /api/cron/events-push, rows from event_push_due). Short TTL: a
// reminder delivered after the night is pointless.
export type EventPush = {
  kind: 'reminder' | 'start'
  eventId: string
  title: Record<Locale, string>
}

export function notifyEvent(userId: string, push: EventPush): Promise<void> {
  return sendToUser(
    userId,
    'events',
    (dict, locale) => ({
      title: fmt(push.kind === 'start' ? dict.events.pushLiveTitle : dict.events.pushSoonTitle, {
        title: push.title[locale],
      }),
      body: push.kind === 'start' ? dict.events.pushLiveBody : dict.events.pushSoonBody,
      url: localePath(locale, push.kind === 'start' ? '/blind-date?event=1' : '/blind-date'),
      tag: `event-${push.eventId}`,
    }),
    { ttl: 20 * 60 },
  )
}

// Secret crush (invite link): the invitee said yes, so it is a match. Sent to the inviter.
export function notifyCrushMatch(inviterId: string, inviteeName: string, matchId: string) {
  inBackground(() =>
    sendToUser(inviterId, 'crush', (dict, locale) => ({
      title: dict.crush.pushTitle,
      body: fmt(dict.crush.pushBody, { name: inviteeName }),
      url: chatUrl(locale, matchId),
      tag: `match-${matchId}`,
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
    // A VIP with the see_likes perk (promo codes) gets the list even when the flag is off.
    const visible = LIKES_VISIBLE_FREE || (await userCanSeeLikes(userId))
    await sendToUser(userId, 'likes', (dict, locale) => ({
      title: dict.likes.pushTitle,
      body: visible ? dict.likes.pushBody : dict.likes.pushBodyLocked,
      url: localePath(locale, visible ? '/likes' : '/swipe'),
      tag: 'likes',
    }))
  })
}

// ---------- Duo Dating (20261009000261): preference 'duo' ----------

const groupUrl = (locale: Locale, groupId: string) => localePath(locale, `/chats/group/${groupId}`)

// An invite by username: the invited friend is told who wants to team up.
export function notifyDuoInvite(userId: string, fromName: string) {
  inBackground(() =>
    sendToUser(userId, 'duo', (dict, locale) => ({
      title: dict.duo.pushInvite,
      body: fmt(dict.duo.pushInviteBody, { name: fromName }),
      url: localePath(locale, '/swipe?mode=duo'),
      tag: 'duo-invite',
    })),
  )
}

// The partner liked a duo for the team: the other member can see it and undo it within an hour.
export function notifyDuoPartnerLiked(likerId: string, likerName: string) {
  inBackground(async () => {
    const { data: team } = await createAdminClient()
      .from('duo_teams')
      .select('user_a, user_b')
      .eq('status', 'active')
      .or(`user_a.eq.${likerId},user_b.eq.${likerId}`)
      .maybeSingle()
    const partner = team && (team.user_a === likerId ? team.user_b : team.user_a)
    if (!partner) return
    await sendToUser(partner, 'duo', (dict, locale) => ({
      title: fmt(dict.duo.pushPartnerLiked, { name: likerName }),
      body: dict.duo.pushPartnerLikedBody,
      url: localePath(locale, '/swipe?mode=duo&inbox=1'),
      tag: 'duo-like',
    }))
  })
}

// Current members of a group, except one.
async function groupRecipients(groupId: string, except: string) {
  const { data } = await createAdminClient()
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .is('left_at', null)
  return (data ?? []).map((m) => m.user_id).filter((id) => id !== except)
}

// A mutual duo like: the three others (the one who completed it sees the match screen).
export function notifyDuoMatch(groupId: string, exceptUserId: string) {
  inBackground(async () => {
    const recipients = await groupRecipients(groupId, exceptUserId)
    await Promise.all(
      recipients.map((id) =>
        sendToUser(id, 'duo', (dict, locale) => ({
          title: dict.duo.pushMatch,
          body: dict.duo.pushMatchBody,
          url: groupUrl(locale, groupId),
          tag: `group-${groupId}`,
        })),
      ),
    )
  })
}

// A group message. Never the text or the photo, nor who sent it (locked screens).
export function notifyGroupMessage(groupId: string, senderId: string, kind: 'text' | 'image') {
  inBackground(async () => {
    const recipients = await groupRecipients(groupId, senderId)
    await Promise.all(
      recipients.map((id) =>
        sendToUser(id, 'duo', (dict, locale) => ({
          title: dict.duo.pushGroupMessage,
          body: kind === 'image' ? dict.duo.pushGroupPhotoBody : dict.duo.pushGroupMessageBody,
          url: groupUrl(locale, groupId),
          tag: `group-${groupId}`,
        })),
      ),
    )
  })
}
