// Gateway-independent payment types. A gateway (Stripe, Billplz, iPay88) is one adapter that
// implements PaymentProvider (src/features/payments/providers/*, listed in registry.ts); the rest
// of the app only sees orders and normalized events. Client-safe: no server imports.
// See docs/payments.md.

export const PROVIDER_IDS = ['stripe', 'billplz', 'ipay88', 'test'] as const
export type PaymentProviderId = (typeof PROVIDER_IDS)[number]

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'failed',
  'refunded',
  'cancelled',
  'expired',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export type PaidPlan = 'plus' | 'vip'
export type PeriodMonths = 1 | 3 | 12

// What an adapter gets to start a checkout. Amounts in sen (RM 1 = 100 sen), MYR only.
export type CheckoutOrder = {
  id: string
  userId: string
  plan: PaidPlan
  periodMonths: PeriodMonths
  amountSen: number
  currency: 'MYR'
}

export type CheckoutContext = {
  // Absolute URL of /[lang]/plans/return?order=<id>: where the gateway sends the user back.
  returnUrl: string
  // Absolute URL of /api/payments/webhook/<provider>: where the gateway reports the outcome.
  webhookUrl: string
  locale: 'en' | 'ms' | 'ru'
  // The gateway's price id from plan_prices.provider_price_id, when it uses one.
  providerPriceId: string | null
}

export type Checkout = {
  // Where to send the browser. Relative only for the in-app test checkout.
  redirectUrl: string
  // The gateway's id for this checkout (session id, bill id, reference no). Unique per provider.
  providerRef: string
}

export type PaymentEventType = 'paid' | 'failed' | 'cancelled' | 'expired' | 'refunded' | 'ignored'

// A verified gateway notification, normalized. Never carries card data: `payload` keeps only ids,
// status and amounts (it is stored for the audit trail).
export type PaymentEvent = {
  provider: PaymentProviderId
  // The gateway's event id (or a stable hash of the notification): deduplication key.
  eventId: string
  type: PaymentEventType
  providerRef: string | null
  amountSen: number | null
  currency: string | null
  payload: Record<string, string | number | boolean | null>
  // Optional reason for failed / cancelled (shown to admins only).
  reason?: string | null
}

export type WebhookRequest = { rawBody: string; headers: Headers }

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookVerificationError'
  }
}

export interface PaymentProvider {
  id: PaymentProviderId
  // Creates the gateway checkout for a pending order.
  createCheckout(order: CheckoutOrder, ctx: CheckoutContext): Promise<Checkout>
  // Verifies the signature of a webhook and normalizes it. Throws WebhookVerificationError when
  // the signature is wrong; returns an 'ignored' event for notifications we do not act on.
  verifyWebhook(req: WebhookRequest): Promise<PaymentEvent>
  // Refunds a paid order in full at the gateway. Absent: the admin refunds in the gateway's
  // dashboard and the panel only records it.
  refund?(order: { id: string; providerRef: string; amountSen: number }): Promise<void>
}

export function isProviderId(v: unknown): v is PaymentProviderId {
  return typeof v === 'string' && (PROVIDER_IDS as readonly string[]).includes(v)
}

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v)
}
