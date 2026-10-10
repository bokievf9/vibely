import {
  WebhookVerificationError,
  type Checkout,
  type CheckoutContext,
  type CheckoutOrder,
  type PaymentEvent,
  type PaymentProvider,
} from '../types'

// The fake gateway for development and staff testing. No money, no network: the checkout is the
// in-app page /[lang]/plans/checkout/test, whose "Pay (test)" / "Fail (test)" buttons run the same
// event handler a real webhook does (processPaymentEvent). It never accepts HTTP webhooks, so
// nobody can mark an order paid from outside. Who may use it: see checkoutMode() in config.ts.

export const testProvider: PaymentProvider = {
  id: 'test',

  async createCheckout(order: CheckoutOrder, ctx: CheckoutContext): Promise<Checkout> {
    return {
      redirectUrl: `/${ctx.locale}/plans/checkout/test?order=${encodeURIComponent(order.id)}`,
      providerRef: testRef(order.id),
    }
  },

  async verifyWebhook(): Promise<PaymentEvent> {
    throw new WebhookVerificationError('The test provider does not accept webhooks')
  },

  async refund() {
    // Nothing to return at a fake gateway.
  },
}

export function testRef(orderId: string): string {
  return `test_${orderId}`
}

// The event the test checkout fires: shaped like a verified webhook.
export function testEvent(
  order: { id: string; amountSen: number; currency: string },
  outcome: 'paid' | 'failed',
  nonce: string,
): PaymentEvent {
  return {
    provider: 'test',
    eventId: `test_${order.id}_${outcome}_${nonce}`,
    type: outcome,
    providerRef: testRef(order.id),
    amountSen: order.amountSen,
    currency: order.currency,
    payload: { order: order.id, outcome },
    reason: outcome === 'failed' ? 'test failure' : null,
  }
}
