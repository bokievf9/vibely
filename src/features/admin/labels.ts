// Russian labels for the moderation panel and moderator notifications (no server-only: also used
// by client components).
import type { Enums } from '@/types/database.types'
import {
  BAN_CODES,
  SHOWN_REJECTION_CODES,
  localizeReason,
  type BanCode,
  type RejectionCode,
  type ShownRejectionCode,
} from '@/features/safety/reason-codes'
import type { REPORT_REASONS } from '@/features/safety/schemas'

export const TARGET_LABELS: Record<Enums<'report_target'>, string> = {
  user: 'Профиль',
  post: 'Пост',
  comment: 'Комментарий',
  random_session: 'Блайнд-дейт',
  message: 'Сообщение',
  photo: 'Фото',
  call: 'Звонок',
  group_message: 'Сообщение в дуо-чате',
  group_member: 'Участник дуо-чата',
  status: 'Статус',
  like_note: 'Записка к лайку',
}

// Users submit a report reason code ("fake: optional details").
export const REPORT_REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  fake: 'Фейковый профиль',
  harassment: 'Оскорбления',
  spam: 'Спам или реклама',
  sexual: 'Сексуальный контент',
  scam: 'Мошенничество',
  underage: 'Младше 18 лет',
}

export const REJECTION_LABELS: Record<RejectionCode, string> = {
  gesture_mismatch: 'Жест не совпадает с заданием',
  face_not_visible: 'Лицо плохо видно',
  face_mismatch: 'Лицо не совпадает с фото профиля',
  screen_photo: 'Фото с экрана или распечатки',
  no_face_photo: 'В профиле нет фото с лицом',
}

// The selfie decision "Looks under 18" (reject + ban, admin_reject_underage).
export const UNDERAGE_REJECTION_LABEL = 'Выглядит младше 18'

export const underageBanText = (banDays: number | null) =>
  banDays ? `заблокирован на ${banDays} дн.` : 'заблокирован бессрочно'

const SHOWN_REJECTION_LABELS: Record<ShownRejectionCode, string> = {
  ...REJECTION_LABELS,
  underage: UNDERAGE_REJECTION_LABEL,
}

export const BAN_LABELS: Record<BanCode, string> = {
  harassment: 'Оскорбления',
  spam: 'Спам или реклама',
  scam: 'Мошенничество',
  fake: 'Фейковый профиль',
  underage: 'Младше 18 лет',
  other: 'Другое (нарушение правил)',
}

const REPORT_CODES = Object.keys(REPORT_REASON_LABELS) as (keyof typeof REPORT_REASON_LABELS)[]

export const readableReportReason = (text: string) =>
  localizeReason(text, REPORT_CODES, REPORT_REASON_LABELS)
export const readableRejection = (text: string) =>
  localizeReason(text, SHOWN_REJECTION_CODES, SHOWN_REJECTION_LABELS)
export const readableBan = (text: string) => localizeReason(text, BAN_CODES, BAN_LABELS)

export const presetsOf = <C extends string>(codes: readonly C[], labels: Record<C, string>) =>
  codes.map((value) => ({ value, label: labels[value] }))
