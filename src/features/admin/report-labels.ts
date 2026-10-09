// Russian labels for the report queue, evidence and flags (admin panel only; also used by client
// components, so no server-only).
import type { Enums } from '@/types/database.types'
import { REPORT_REASONS } from '@/features/safety/schemas'
import { REPORT_REASON_LABELS } from './labels'

export type ReportTarget = Enums<'report_target'>
export type CaseStatus = 'open' | 'in_review'
export type CaseDecision = 'dismiss' | 'hide' | 'ban' | 'delete_photo'
export type FlagKind = 'phone' | 'link' | 'messenger' | 'money' | 'keyword'

export const REPORT_TARGETS = [
  'user',
  'message',
  'photo',
  'call',
  'post',
  'comment',
  'random_session',
  'group_message',
  'group_member',
  'status',
] as const satisfies readonly ReportTarget[]

export const REASON_CODES = REPORT_REASONS

export const STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'Новая',
  in_review: 'На проверке',
}

export const DECISION_LABELS: Record<CaseDecision, string> = {
  dismiss: 'Отклонено',
  hide: 'Контент скрыт',
  ban: 'Блокировка',
  delete_photo: 'Фото удалено',
}

export const readableDecision = (d: string | null) =>
  d && d in DECISION_LABELS ? DECISION_LABELS[d as CaseDecision] : 'Закрыто'

// Severity tier of a case (most severe reason): 4 underage, 3 scam/sexual, 2 harassment, 1 other.
export function tierLabel(tier: number): { label: string; className: string } {
  if (tier >= 4) return { label: 'Критично', className: 'bg-red-600 text-white' }
  if (tier === 3) return { label: 'Высокий', className: 'bg-red-500/15 text-red-400' }
  if (tier === 2) return { label: 'Средний', className: 'bg-amber-500/15 text-amber-400' }
  return { label: 'Обычный', className: 'bg-border text-muted' }
}

export const FLAG_LABELS: Record<FlagKind, string> = {
  phone: 'Телефон',
  link: 'Ссылка',
  messenger: 'Мессенджер',
  money: 'Деньги',
  keyword: 'Ключевое слово',
}

export const reasonLabel = (code: string) =>
  code in REPORT_REASON_LABELS
    ? REPORT_REASON_LABELS[code as keyof typeof REPORT_REASON_LABELS]
    : code

// Age of the oldest report in a case. Targets: under 4 h fine, under 24 h due, older overdue.
export function slaOf(ageMinutes: number): { label: string; className: string } {
  const label =
    ageMinutes < 60
      ? `${Math.max(1, ageMinutes)} мин`
      : ageMinutes < 48 * 60
        ? `${Math.floor(ageMinutes / 60)} ч`
        : `${Math.floor(ageMinutes / (24 * 60))} дн`
  const className =
    ageMinutes < 4 * 60
      ? 'bg-emerald-500/15 text-emerald-400'
      : ageMinutes < 24 * 60
        ? 'bg-amber-500/15 text-amber-400'
        : 'bg-red-500/15 text-red-400'
  return { label, className }
}
