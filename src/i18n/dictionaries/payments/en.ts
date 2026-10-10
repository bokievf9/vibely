// Payments (20261011000100): checkout buttons, the return page, the test checkout and the
// payment history in Settings. Amounts are shown as "RM 29.90" in every language.
export const paymentsEn = {
  buy: 'Get {plan}',
  buyTest: 'Get {plan} (test)',
  testMode: 'Test mode for the team: no real payment is taken.',
  draftPrice: 'Draft price, visible to the team only',
  legalLive: 'A one-off payment for the period you choose. It does not renew automatically.',
  periods: { m1: '1 month', m3: '3 months', m12: '12 months' },
  planPeriod: '{plan}, {period}',
  statuses: {
    pending: 'Pending',
    paid: 'Paid',
    failed: 'Failed',
    refunded: 'Refunded',
    cancelled: 'Cancelled',
    expired: 'Expired',
  },
  history: {
    section: 'Payments',
    title: 'Payment history',
    hint: 'Your plan purchases',
    empty: 'No payments yet.',
    test: 'Test',
  },
  return: {
    title: 'Payment',
    pending: 'Waiting for confirmation',
    pendingBody:
      'The payment provider is confirming your payment. This usually takes a few seconds. You can leave this page: your plan turns on as soon as it is confirmed.',
    slow: 'Still waiting. Check Payment history in Settings in a few minutes.',
    paid: 'Payment received',
    paidBody: 'Vibely {plan} is now yours. Enjoy!',
    failed: 'The payment did not go through',
    failedBody: 'The payment was not completed. You can try again from the Plans page.',
    cancelled: 'Checkout was cancelled',
    cancelledBody: 'Nothing was bought. You can start again from the Plans page.',
    refunded: 'This payment was refunded',
    refundedBody: 'The plan from this payment has ended.',
    notFound: 'We could not find this payment.',
    toPlans: 'Back to Plans',
    toHistory: 'Payment history',
  },
  test: {
    title: 'Test checkout',
    body: 'For the team only. This page stands in for the payment provider: nothing is charged and no card details are asked for.',
    amount: 'Amount',
    pay: 'Pay (test)',
    fail: 'Fail (test)',
    unavailable: 'The test checkout is not available.',
    done: 'This order is no longer waiting for payment.',
  },
}

export const paymentErrorsEn = {
  paymentsUnavailable: 'Payments are not available yet.',
  priceUnavailable: 'This plan cannot be bought right now.',
  checkoutFailed: 'We could not open the checkout. Please try again.',
}

export type PaymentsDictionary = typeof paymentsEn
