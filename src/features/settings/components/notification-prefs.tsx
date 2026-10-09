'use client'

import {
  CalendarHeart,
  Handshake,
  Heart,
  HeartHandshake,
  Lightbulb,
  MessageCircle,
  MessageSquareLock,
  Phone,
  Newspaper,
  Smile,
  Sparkles,
  UserPlus,
  VenetianMask,
  type LucideIcon,
} from 'lucide-react'
import { useI18n } from '@/i18n/client'
import {
  NOTIFICATION_TYPES,
  type NotificationPrefs,
  type NotificationType,
} from '@/features/push/prefs'
import { setNotificationPref } from '../actions'
import { SwitchRow } from './switch-row'

const ICONS: Record<NotificationType, LucideIcon> = {
  new_matches: Heart,
  messages: MessageCircle,
  likes: Sparkles,
  feed_replies: Newspaper,
  random_reveal: VenetianMask,
  new_people: UserPlus,
  calls: Phone,
  matchmaker: Handshake,
  events: CalendarHeart,
  crush: HeartHandshake,
  post_replies: MessageSquareLock,
  daily_prompt: Lightbulb,
  status_replies: Smile,
}

// Settings → Notifications: one switch per push type (stored per account, not per device).
export function NotificationPrefsRows({ initial }: { initial: NotificationPrefs }) {
  const { dict } = useI18n()
  return (
    <>
      <p className="text-muted px-4 pt-3 text-sm">{dict.settings.notifyTypesHint}</p>
      {NOTIFICATION_TYPES.map((type) => (
        <SwitchRow
          key={type}
          icon={ICONS[type]}
          label={dict.settings.notifyTypes[type]}
          initial={initial[type]}
          save={(enabled) => setNotificationPref(type, enabled)}
        />
      ))}
    </>
  )
}
