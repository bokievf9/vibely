// Prices per paid plan and billing period, shown on the Plans screen. The owner set monthly prices
// (Plus RM 9.90, VIP RM 19.90, 2026-10-11); longer periods are not sold. The prices that
// are charged live in the database (plan_prices, 20261011000100, set by the owner in /admin/plans):
// the order amount comes from there, never from the client. The Plans screen shows them only when
// checkout is open to the viewer (payments enabled, or test mode for staff); otherwise these nulls.
// Client-safe: no server imports.

export const BILLING_PERIODS = ['month', 'quarter', 'year'] as const
export type BillingPeriod = (typeof BILLING_PERIODS)[number]

// Periods offered to users. Only monthly for now: with one period the Plans screen hides the
// Monthly / 3 months / 12 months toggle. The database and checkout still support 3 and 12 months,
// so adding them back is a price in /admin/plans plus an entry here.
export const OFFERED_PERIODS: readonly BillingPeriod[] = ['month']

export const BILLING_MONTHS: Record<BillingPeriod, number> = { month: 1, quarter: 3, year: 12 }

export type PlanPrice = { amount: number; currency: 'MYR' } | null

export type PaidPlan = 'plus' | 'vip'

export const PLAN_PRICES: Record<PaidPlan, Record<BillingPeriod, PlanPrice>> = {
  plus: { month: { amount: 9.9, currency: 'MYR' }, quarter: null, year: null },
  vip: { month: { amount: 19.9, currency: 'MYR' }, quarter: null, year: null },
}

// False until the owner picks a gateway and prices: the buy buttons stay "Coming soon" for users.
// Staff can still try the whole flow with the test gateway (src/features/payments/registry.ts).
export const PAYMENTS_ENABLED = false

export type PriceTable = Record<PaidPlan, Record<BillingPeriod, PlanPrice>>

export function planPrice(
  plan: PaidPlan,
  period: BillingPeriod,
  table: PriceTable = PLAN_PRICES,
): PlanPrice {
  return table[plan][period]
}

export const MONTHS_PERIOD: Record<number, BillingPeriod | undefined> = {
  1: 'month',
  3: 'quarter',
  12: 'year',
}

// Database rows (amounts in sen) only. Unknown plans or periods are skipped. The static display
// prices are not merged in: with checkout open, a buy button must never appear for a price the
// database (which sets the order amount) does not have.
export function priceTable(
  rows: readonly { plan: string; period_months: number; amount_sen: number }[],
): PriceTable {
  const table: PriceTable = {
    plus: { month: null, quarter: null, year: null },
    vip: { month: null, quarter: null, year: null },
  }
  for (const r of rows) {
    const period = MONTHS_PERIOD[r.period_months]
    if ((r.plan === 'plus' || r.plan === 'vip') && period && r.amount_sen > 0) {
      table[r.plan][period] = { amount: r.amount_sen / 100, currency: 'MYR' }
    }
  }
  return table
}

// "RM 29.90" from sen.
export function formatSen(sen: number): string {
  return formatPrice({ amount: sen / 100, currency: 'MYR' })
}

// "RM 29.90"; Malaysian formatting whatever the UI language.
export function formatPrice(price: NonNullable<PlanPrice>): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: price.currency,
    minimumFractionDigits: Number.isInteger(price.amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price.amount)
}

// Price per month for a longer period (shown under the total), or null for monthly billing.
export function monthlyEquivalent(price: PlanPrice, period: BillingPeriod): PlanPrice {
  if (!price || period === 'month') return null
  return { ...price, amount: Math.round((price.amount / BILLING_MONTHS[period]) * 100) / 100 }
}
