import type { FeatureKey, PlanLevel } from '@/features/plans/access'
import type { LandingDictionary } from '@/i18n/dictionaries/landing/en'

// The landing page's short Free / Plus / VIP comparison. Static on purpose (the page is
// prerendered and has no session), so it mirrors the seeded matrix of 20261009000280_plans.sql;
// tests/unit/landing.test.mjs fails when the two drift apart. The live matrix (editable in
// /admin/plans) is what the app enforces.

export type PlanCell =
  | { kind: 'limit'; n: number; period: 'day' | 'week' | 'month' }
  | { kind: 'unlimited' }
  | { kind: 'yes' }
  | { kind: 'no' }

export type PlanRow = {
  row: keyof LandingDictionary['plans']['rows']
  // Every feature this row stands for (media = photos + voice + video messages).
  features: FeatureKey[]
  cells: Record<PlanLevel, PlanCell>
}

const no = { kind: 'no' } as const
const yes = { kind: 'yes' } as const
const unlimited = { kind: 'unlimited' } as const
const perDay = (n: number) => ({ kind: 'limit', n, period: 'day' }) as const

export const PLAN_ROWS: PlanRow[] = [
  {
    row: 'likes',
    features: ['likes_per_day'],
    cells: { free: perDay(100), plus: unlimited, vip: unlimited },
  },
  {
    row: 'blindDates',
    features: ['blind_dating_per_day'],
    cells: { free: perDay(3), plus: perDay(10), vip: unlimited },
  },
  { row: 'whoLiked', features: ['who_liked_you'], cells: { free: no, plus: yes, vip: yes } },
  {
    row: 'media',
    features: ['chat_photos', 'voice_messages', 'video_messages'],
    cells: { free: no, plus: yes, vip: yes },
  },
  {
    row: 'feedPost',
    features: ['feed_post', 'feed_comment'],
    cells: { free: no, plus: yes, vip: yes },
  },
  {
    row: 'boost',
    features: ['boost'],
    cells: {
      free: no,
      plus: { kind: 'limit', n: 1, period: 'month' },
      vip: { kind: 'limit', n: 1, period: 'week' },
    },
  },
  { row: 'calls', features: ['calls'], cells: { free: no, plus: no, vip: yes } },
]

// "100 a day", "Unlimited"; null for yes/no cells (they render an icon with a label).
export function planCellText(cell: PlanCell, t: LandingDictionary['plans']): string | null {
  switch (cell.kind) {
    case 'limit': {
      const template =
        cell.period === 'day' ? t.perDay : cell.period === 'week' ? t.perWeek : t.perMonth
      return template.replace('{n}', String(cell.n))
    }
    case 'unlimited':
      return t.unlimited
    default:
      return null
  }
}
