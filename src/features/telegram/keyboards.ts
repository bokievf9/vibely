import 'server-only'
import { BAN_LABELS, REJECTION_LABELS } from '@/features/admin/labels'
import { BAN_CODES, REJECTION_CODES } from '@/features/safety/reason-codes'
import { adminUrl, type InlineButton, type Keyboard } from './client'
import { encodeCallback, type ReportTargetType } from './protocol'

const btn = (text: string, data: Parameters<typeof encodeCallback>[0]): InlineButton => ({
  text,
  callback_data: encodeCallback(data),
})
const link = (text: string, path: string): InlineButton => ({ text, url: adminUrl(path) })
const pairs = (buttons: InlineButton[]) =>
  buttons.reduce<InlineButton[][]>((rows, b, i) => {
    if (i % 2 === 0) rows.push([b])
    else rows[rows.length - 1]!.push(b)
    return rows
  }, [])

export const selfieKeyboard = (id: string): Keyboard => ({
  inline_keyboard: [
    [
      btn('✅ Одобрить', { a: 'selfie_approve', id }),
      btn('❌ Отклонить', { a: 'selfie_reject_menu', id }),
    ],
    [link('Открыть в админке', '/admin/verification')],
  ],
})

export const rejectKeyboard = (id: string): Keyboard => ({
  inline_keyboard: [
    ...pairs(
      REJECTION_CODES.map((code) => btn(REJECTION_LABELS[code], { a: 'selfie_reject', id, code })),
    ),
    [btn('← Назад', { a: 'selfie_back', id })],
  ],
})

export const openOnly = (path: string): Keyboard => ({
  inline_keyboard: [[link('Открыть в админке', path)]],
})

export const reportPath = (t: ReportTargetType, offenderId: string | null) =>
  t === 'user' ? `/admin/users/${offenderId ?? ''}` : '/admin/reports'

export function reportKeyboard(
  t: ReportTargetType,
  id: string,
  opts: { canBan: boolean; offenderId: string | null },
): Keyboard {
  const actions = [btn('Отклонить жалобу', { a: 'report_dismiss', t, id })]
  if (t === 'post' || t === 'comment') actions.push(btn('Скрыть', { a: 'report_hide', t, id }))
  if (opts.canBan) actions.push(btn('🔨 Бан', { a: 'report_ban_menu', t, id }))
  return {
    inline_keyboard: [
      ...pairs(actions),
      [link('Открыть в админке', reportPath(t, opts.offenderId))],
    ],
  }
}

export const banReasonKeyboard = (t: ReportTargetType, id: string): Keyboard => ({
  inline_keyboard: [
    ...pairs(
      BAN_CODES.map((code) => btn(BAN_LABELS[code], { a: 'report_ban_confirm', t, id, code })),
    ),
    [btn('← Назад', { a: 'report_back', t, id })],
  ],
})

export const banConfirmKeyboard = (t: ReportTargetType, id: string, code: string): Keyboard => ({
  inline_keyboard: [
    [
      btn('Да, заблокировать', { a: 'report_ban', t, id, code }),
      btn('Отмена', { a: 'report_back', t, id }),
    ],
  ],
})

export const userBanConfirmKeyboard = (id: string, code: string): Keyboard => ({
  inline_keyboard: [
    [btn('Да, заблокировать', { a: 'user_ban', id, code }), btn('Отмена', { a: 'cancel' })],
  ],
})

export const userUnbanConfirmKeyboard = (id: string): Keyboard => ({
  inline_keyboard: [
    [btn('Да, разблокировать', { a: 'user_unban', id }), btn('Отмена', { a: 'cancel' })],
  ],
})
