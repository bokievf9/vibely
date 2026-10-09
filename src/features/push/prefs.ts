import { z } from 'zod'

// Per-type push preferences, one boolean column each in public.notification_prefs.
// No row (or a missing column) means "on".
export const NOTIFICATION_TYPES = [
  'new_matches',
  'messages',
  'likes',
  'feed_replies',
  'random_reveal',
  'new_people',
  'calls',
  'events',
  'crush',
  'post_replies',
  'daily_prompt',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]
export type NotificationPrefs = Record<NotificationType, boolean>

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES)

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  new_matches: true,
  messages: true,
  likes: true,
  feed_replies: true,
  random_reveal: true,
  new_people: true,
  calls: true,
  events: true,
  crush: true,
  post_replies: true,
  daily_prompt: true,
}
