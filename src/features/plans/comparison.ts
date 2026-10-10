import type { FeatureKey, LimitPeriod, PlanLevel } from './access'

// The plan catalog (public.features + public.plan_limits, readable by every signed-in user) turned
// into what the Plans screen and the upgrade sheet show: a comparison grouped by theme, the cell of
// each plan, the limit text and the top benefits of a plan. Everything is derived from the live
// matrix, so a change in /admin/plans shows up on the next request. Pure: no runtime imports, so
// the unit tests load it directly.

const LEVELS = ['free', 'plus', 'vip'] as const satisfies readonly PlanLevel[]
const rank = (p: PlanLevel) => LEVELS.indexOf(p)

export type CatalogLimit = { limit: number | null; period: LimitPeriod | null }

export type CatalogFeature = {
  key: FeatureKey
  minPlan: PlanLevel
  enabled: boolean
  sort: number
  // Only the plans that have a row in plan_limits.
  limits: Partial<Record<PlanLevel, CatalogLimit>>
}

export type Catalog = CatalogFeature[]

export const FEATURE_GROUPS = ['chat', 'discover', 'blind', 'feed', 'privacy', 'extras'] as const
export type FeatureGroup = (typeof FEATURE_GROUPS)[number]

// Theme of every known key. Keys added to the matrix later need a label in en/ms/ru first, so
// unknown keys never reach this module (parseCatalog drops them).
export const GROUP_OF: Record<FeatureKey, FeatureGroup> = {
  chat_photos: 'chat',
  voice_messages: 'chat',
  video_messages: 'chat',
  calls: 'chat',
  read_receipts: 'chat',
  message_before_match: 'chat',
  likes_per_day: 'discover',
  who_liked_you: 'discover',
  boost: 'discover',
  discover_priority: 'discover',
  profile_visitors: 'discover',
  crossed_paths: 'discover',
  blind_dating_per_day: 'blind',
  event_priority: 'blind',
  duo: 'blind',
  feed_post: 'feed',
  feed_comment: 'feed',
  feed_like: 'feed',
  incognito: 'privacy',
  vip_badge: 'extras',
  crush_links_per_30d: 'extras',
  statuses: 'extras',
}

// What people notice first, for "top benefits" lists (the matrix sort is the admin's order).
const HIGHLIGHT: FeatureKey[] = [
  'likes_per_day',
  'who_liked_you',
  'chat_photos',
  'voice_messages',
  'calls',
  'profile_visitors',
  'read_receipts',
  'message_before_match',
  'boost',
  'blind_dating_per_day',
  'feed_post',
  'incognito',
  'video_messages',
  'discover_priority',
  'event_priority',
  'vip_badge',
  'crush_links_per_30d',
  'feed_comment',
  'feed_like',
  'duo',
  'statuses',
  'crossed_paths',
]

// no: not in this plan; yes: included, no quota; unlimited: a quota feature with no cap in this
// plan; limit: capped per period.
export type Cell =
  | { kind: 'no' }
  | { kind: 'yes' }
  | { kind: 'unlimited' }
  | { kind: 'limit'; limit: number; period: LimitPeriod | null }

const hasQuota = (f: CatalogFeature) =>
  Object.values(f.limits).some((l) => l !== undefined && l.limit !== null)

// Mirrors has_feature / feature_limit (20261009000280) for a non-staff user on `plan`.
export function cellFor(f: CatalogFeature, plan: PlanLevel): Cell {
  if (!f.enabled || rank(plan) < rank(f.minPlan)) return { kind: 'no' }
  const l = f.limits[plan]
  if (l && l.limit !== null) {
    return l.limit === 0 ? { kind: 'no' } : { kind: 'limit', limit: l.limit, period: l.period }
  }
  return hasQuota(f) ? { kind: 'unlimited' } : { kind: 'yes' }
}

// 0 (none) < limit (by the yearly amount) < yes / unlimited.
function cellValue(c: Cell): number {
  if (c.kind === 'no') return 0
  if (c.kind === 'limit') {
    const per = c.period === 'day' ? 365 : c.period === 'week' ? 52 : c.period === 'month' ? 12 : 1
    return 1 + c.limit * per
  }
  return Number.POSITIVE_INFINITY
}

export const cellsEqual = (a: Cell, b: Cell) => cellValue(a) === cellValue(b)

export type ComparisonRow = { key: FeatureKey; cells: Record<PlanLevel, Cell> }
export type ComparisonGroup = { group: FeatureGroup; rows: ComparisonRow[] }

// Enabled features grouped by theme (groups in FEATURE_GROUPS order, rows in the matrix sort).
// Disabled features are hidden: nobody but the team can use them.
export function comparisonGroups(catalog: Catalog): ComparisonGroup[] {
  const sorted = [...catalog]
    .filter((f) => f.enabled)
    .sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key))
  return FEATURE_GROUPS.map((group) => ({
    group,
    rows: sorted
      .filter((f) => GROUP_OF[f.key] === group)
      .map((f) => ({
        key: f.key,
        cells: { free: cellFor(f, 'free'), plus: cellFor(f, 'plus'), vip: cellFor(f, 'vip') },
      })),
  })).filter((g) => g.rows.length > 0)
}

// What `plan` adds over the level below it (newly unlocked or a higher quota), most noticeable
// first. `limit` caps the list.
export function planBenefits(catalog: Catalog, plan: Exclude<PlanLevel, 'free'>, limit = 4) {
  const below = LEVELS[rank(plan) - 1] ?? 'free'
  const gains = catalog.filter((f) => cellValue(cellFor(f, plan)) > cellValue(cellFor(f, below)))
  const order = (k: FeatureKey) => {
    const i = HIGHLIGHT.indexOf(k)
    return i === -1 ? HIGHLIGHT.length : i
  }
  return gains
    .sort((a, b) => order(a.key) - order(b.key))
    .slice(0, limit)
    .map((f) => ({ key: f.key, cell: cellFor(f, plan) }))
}

// What a plan includes at all (the Free card), most noticeable first.
export function planIncludes(catalog: Catalog, plan: PlanLevel, limit = 4) {
  const order = (k: FeatureKey) => {
    const i = HIGHLIGHT.indexOf(k)
    return i === -1 ? HIGHLIGHT.length : i
  }
  return catalog
    .map((f) => ({ key: f.key, cell: cellFor(f, plan) }))
    .filter((x) => x.cell.kind !== 'no')
    .sort((a, b) => order(a.key) - order(b.key))
    .slice(0, limit)
}

// Rows where Plus and VIP differ, for the mini comparison in the upgrade sheet. The tapped
// feature comes first when it is part of the catalog.
export function plusVsVip(catalog: Catalog, first?: FeatureKey, limit = 4): ComparisonRow[] {
  const rows = comparisonGroups(catalog).flatMap((g) => g.rows)
  const differ = rows.filter((r) => !cellsEqual(r.cells.plus, r.cells.vip))
  const order = (k: FeatureKey) => (k === first ? -1 : HIGHLIGHT.indexOf(k))
  const lead = rows.find((r) => r.key === first)
  const picked = [...(lead ? [lead] : []), ...differ.filter((r) => r.key !== first)]
  return picked.sort((a, b) => order(a.key) - order(b.key)).slice(0, limit)
}

export type LimitTexts = {
  unlimited: string
  included: string
  notIncluded: string
  limitPer: Record<LimitPeriod, string>
  limitTotal: string
}

// "100 per day", "Unlimited", "Included", "Not included".
export function cellText(cell: Cell, t: LimitTexts): string {
  switch (cell.kind) {
    case 'no':
      return t.notIncluded
    case 'yes':
      return t.included
    case 'unlimited':
      return t.unlimited
    case 'limit': {
      const tpl = cell.period ? t.limitPer[cell.period] : t.limitTotal
      return tpl.replace('{count}', String(cell.limit))
    }
  }
}

type FeatureRow = { key: string; min_plan: string; enabled: boolean; sort: number }
type LimitRow = {
  feature_key: string
  plan: string
  limit_value: number | null
  period: string | null
}

const isLevel = (v: string): v is PlanLevel => (LEVELS as readonly string[]).includes(v)
const isPeriod = (v: string | null): v is LimitPeriod =>
  v === 'day' || v === 'week' || v === 'month'

// Rows of public.features and public.plan_limits -> Catalog. Unknown keys (no labels yet) and
// malformed rows are skipped.
export function parseCatalog(
  features: FeatureRow[],
  limits: LimitRow[],
  isKnown: (key: string) => key is FeatureKey,
): Catalog {
  const out: Catalog = []
  for (const f of features) {
    if (!isKnown(f.key) || !isLevel(f.min_plan)) continue
    const own: CatalogFeature['limits'] = {}
    for (const l of limits) {
      if (l.feature_key !== f.key || !isLevel(l.plan)) continue
      own[l.plan] = { limit: l.limit_value, period: isPeriod(l.period) ? l.period : null }
    }
    out.push({ key: f.key, minPlan: f.min_plan, enabled: f.enabled, sort: f.sort, limits: own })
  }
  return out
}
