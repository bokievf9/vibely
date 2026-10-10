// Prices per paid plan and billing period. Payments are not connected yet and the owner has not set
// prices, so every value is null and the Plans screen shows "Price coming soon". When prices are
// decided, fill them in here (amounts in ringgit, the whole amount charged for the period); the
// cards pick them up without other changes. Client-safe: no server imports.

export const BILLING_PERIODS = ['month', 'quarter', 'year'] as const
export type BillingPeriod = (typeof BILLING_PERIODS)[number]

export const BILLING_MONTHS: Record<BillingPeriod, number> = { month: 1, quarter: 3, year: 12 }

export type PlanPrice = { amount: number; currency: 'MYR' } | null

export type PaidPlan = 'plus' | 'vip'

export const PLAN_PRICES: Record<PaidPlan, Record<BillingPeriod, PlanPrice>> = {
  plus: { month: null, quarter: null, year: null },
  vip: { month: null, quarter: null, year: null },
}

// False until checkout exists: the buy buttons stay "Coming soon".
export const PAYMENTS_ENABLED = false

export function planPrice(plan: PaidPlan, period: BillingPeriod): PlanPrice {
  return PLAN_PRICES[plan][period]
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
