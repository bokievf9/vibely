import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { BAN_LABELS, REPORT_REASON_LABELS, TARGET_LABELS } from '@/features/admin/labels'
import type { BanCode } from '@/features/safety/reason-codes'
import { admit, editText, getBot, sendText } from './client'
import { openOnly, reportKeyboard, reportPath } from './keyboards'
import { plain, type ReportTargetType } from './protocol'

// Report notifications. Never the reporter, never the free-text details, never message or post
// content: only the category, the target type, how many open reports and the priority. One
// message per target: new reports on the same target edit it instead of posting again.

type Summary = {
  open_reports: number
  offender_id: string | null
  offender_reports_1h: number
  underage: boolean
  auto_hidden: boolean
  latest_reason: string | null
}

const BURST_THRESHOLD = 3

export type Priority = 'urgent' | 'high' | 'normal'

export const priorityOf = (
  s: Pick<Summary, 'underage' | 'open_reports' | 'offender_reports_1h'>,
): Priority =>
  s.underage
    ? 'urgent'
    : s.open_reports >= 3 || s.offender_reports_1h >= BURST_THRESHOLD
      ? 'high'
      : 'normal'

const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: '🔴 срочно',
  high: '🟠 высокий',
  normal: '⚪ обычный',
}

const reasonLabel = (code: string | null) =>
  code && code in REPORT_REASON_LABELS
    ? `${REPORT_REASON_LABELS[code as keyof typeof REPORT_REASON_LABELS]} (${code})`
    : 'другое'

async function summaryOf(t: ReportTargetType, id: string): Promise<Summary | null> {
  const { data, error } = await createAdminClient()
    .rpc('telegram_report_summary', { p_type: t, p_target: id })
    .maybeSingle()
  if (error) console.error('[telegram] report summary failed:', error.code)
  return data ?? null
}

export async function handleOf(userId: string | null, withStatus = true): Promise<string> {
  if (!userId) return 'неизвестен'
  const { data } = await createAdminClient()
    .from('profiles')
    .select('username, banned_at')
    .eq('id', userId)
    .maybeSingle()
  if (!data) return 'удалён'
  return `@${data.username}${withStatus && data.banned_at ? ' (заблокирован)' : ''}`
}

async function reportText(t: ReportTargetType, s: Summary) {
  return [
    `🚩 Жалоба · приоритет: ${PRIORITY_LABEL[priorityOf(s)]}`,
    `Объект: ${TARGET_LABELS[t]}`,
    `Причина: ${reasonLabel(s.latest_reason)}`,
    `Открытых жалоб: ${s.open_reports}`,
    `Аккаунт: ${await handleOf(s.offender_id)}`,
  ].join('\n')
}

type Posted = { id: string; chat_id: number; control_message_id: number | null }

async function openReportMessage(t: ReportTargetType, id: string): Promise<Posted | null> {
  const { data } = await createAdminClient()
    .from('telegram_messages')
    .select('id, chat_id, control_message_id')
    .eq('kind', 'report')
    .eq('ref_type', t)
    .eq('ref_id', id)
    .is('closed_at', null)
    .maybeSingle()
  return data
}

export const keyboardFor = (t: ReportTargetType, id: string, s: Summary) =>
  reportKeyboard(t, id, { canBan: !!s.offender_id, offenderId: s.offender_id })

// The current text and buttons of a report message (also used by "Back" in the ban flow).
export async function reportView(t: ReportTargetType, id: string) {
  const s = await summaryOf(t, id)
  if (!s) return null
  return { text: await reportText(t, s), keyboard: keyboardFor(t, id, s), summary: s }
}

export async function postReport(t: ReportTargetType, id: string) {
  if (!getBot()) return
  const s = await summaryOf(t, id)
  if (!s || s.open_reports === 0) return
  const text = await reportText(t, s)

  await alertsFor(t, id, s)

  const existing = await openReportMessage(t, id)
  if (existing?.control_message_id) {
    const res = await editText(
      existing.chat_id,
      existing.control_message_id,
      text,
      keyboardFor(t, id, s),
    )
    // "message is not modified" or a deleted message: fall through only when it is gone.
    if (res.ok || /not modified/i.test(res.description)) return
  }
  if (!admit('report')) return
  const msg = await sendText('reports', text, keyboardFor(t, id, s))
  if (!msg) return
  const { error } = await createAdminClient().rpc('telegram_record_message', {
    p_kind: 'report',
    p_ref_type: t,
    p_ref_id: id,
    p_chat: msg.chat.id,
    p_photos: [],
    p_control: msg.message_id,
  })
  if (error) console.error('[telegram] record report failed:', error.code)
}

async function alertsFor(t: ReportTargetType, id: string, s: Summary) {
  const who = await handleOf(s.offender_id)
  if (s.underage && admit('alert', `underage:${t}:${id}`, 60 * 60_000)) {
    await sendText(
      'alerts',
      `🚨 СРОЧНО: жалоба «Младше 18 лет»\nОбъект: ${TARGET_LABELS[t]}\nАккаунт: ${who}`,
      openOnly(reportPath(t, s.offender_id)),
    )
  }
  if (
    s.offender_id &&
    s.offender_reports_1h >= BURST_THRESHOLD &&
    admit('alert', `burst:${s.offender_id}`, 60 * 60_000)
  ) {
    await sendText(
      'alerts',
      `🚨 ${s.offender_reports_1h} жалоб на один аккаунт за час\nАккаунт: ${who}`,
      openOnly(`/admin/users/${s.offender_id}`),
    )
  }
  if (s.auto_hidden && admit('alert', `autohide:${t}:${id}`, 24 * 60 * 60_000)) {
    await sendText(
      'alerts',
      `🙈 Автоскрытие: ${TARGET_LABELS[t]} скрыт после ${s.open_reports} жалоб\nАвтор: ${who}`,
      openOnly('/admin/content'),
    )
  }
}

// After a decision (Telegram or panel): the message shows who decided, buttons go away.
export async function closeReport(t: ReportTargetType, id: string, outcome: string) {
  if (!getBot()) return
  const m = await openReportMessage(t, id)
  if (!m) return
  if (m.control_message_id) {
    await editText(
      m.chat_id,
      m.control_message_id,
      `🚩 Жалоба · ${TARGET_LABELS[t]}\n${outcome}`,
      openOnly(t === 'user' ? `/admin/users/${id}` : '/admin/reports'),
    )
  }
  await createAdminClient()
    .from('telegram_messages')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', m.id)
}

// Ban/unban by any moderator (panel or bot), so the team stays in sync.
export async function postBanChange(input: {
  moderator: string
  userId: string
  banned: boolean
  reason?: string
}) {
  if (!getBot() || !admit('alert')) return
  const who = await handleOf(input.userId, false)
  const code = (input.reason ?? '').split(':')[0]?.trim() as BanCode
  const reason = BAN_LABELS[code] ?? 'другое'
  const text = input.banned
    ? `🔨 ${plain(input.moderator, 80)} заблокировал(а) ${who}\nПричина: ${reason} (${plain(code, 24)})`
    : `♻️ ${plain(input.moderator, 80)} разблокировал(а) ${who}`
  await sendText('alerts', text, openOnly(`/admin/users/${input.userId}`))
}
