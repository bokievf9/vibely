import { BAN_CODES, localizeReason } from '@/features/safety/reason-codes'
import { fmt } from '@/i18n/config'
import { formatDay, formatTime } from '@/i18n/format'
import { getDictionary, getLocale } from '@/i18n/server'
import { getMySanctions } from '../queries'
import { SanctionNoticeModal, type Notice } from './sanction-notice-modal'

// Tells the user about an unacknowledged warning (once, until acknowledged) and an active mute
// (once per mute on this device). Mounted in the (main) layout.
export async function SanctionNotice() {
  const [sanctions, dict, locale] = await Promise.all([
    getMySanctions(),
    getDictionary(),
    getLocale(),
  ])
  if (!sanctions) return null
  const t = dict.sanctions
  const reason = (r: string | null) => (r ? localizeReason(r, BAN_CODES, dict.moderation.ban) : '')
  const when = (iso: string) => `${formatDay(iso, locale)} ${formatTime(iso, locale)}`

  const notices: Notice[] = sanctions.warnings.map((w) => ({
    kind: 'warning',
    id: w.id,
    title: t.warningTitle,
    body: fmt(t.warningBody, { reason: reason(w.reason) }),
    detail: fmt(t.warningUntil, { date: formatDay(w.expiresAt, locale) }),
    ok: t.warningOk,
  }))
  if (sanctions.mutedUntil) {
    notices.push({
      kind: 'mute',
      id: sanctions.mutedUntil,
      title: t.mutedTitle,
      body: fmt(t.mutedBody, {
        date: when(sanctions.mutedUntil),
        reason: reason(sanctions.muteReason),
      }),
      ok: t.mutedOk,
    })
  }
  if (!notices.length) return null
  return <SanctionNoticeModal notices={notices} />
}
