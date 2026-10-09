// Russian labels for /admin/plans (client and server).
import type { LimitPeriod, PlanLevel } from './plans-schemas'

export const PLAN_LABELS: Record<PlanLevel, string> = { free: 'Free', plus: 'Plus', vip: 'VIP' }

export const PERIOD_LABELS: Record<LimitPeriod, string> = {
  day: 'в день',
  week: 'в неделю',
  month: 'в месяц (30 дней)',
}

export const SOURCE_LABELS: Record<string, string> = {
  promo: 'Промокод',
  matchmaker: 'Сваха',
  referral: 'Реферал',
  admin: 'Админ',
  purchase: 'Покупка',
  legacy: 'Старый VIP',
}

export const sourceLabel = (s: string) => SOURCE_LABELS[s] ?? s
