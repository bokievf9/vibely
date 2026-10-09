import type { Locale } from '@/i18n/config'

// The event shown to clients (get_current_event, 20261009000210): the live one, or the next
// scheduled one. Counts only, never identities. `status` is the effective status by the server
// clock; `serverNow` lets the client correct its own clock for the countdown.
export type CurrentEvent = {
  id: string
  title: Record<Locale, string>
  theme: string | null
  startsAt: string
  endsAt: string
  status: 'scheduled' | 'live'
  inRoom: number
  joined: number
  reminded: boolean
  serverNow: string
}
