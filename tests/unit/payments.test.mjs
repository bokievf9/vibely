// npm run test:unit. Provider registry, checkout gating and the test gateway. No network, no money.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// src/features/payments uses extensionless relative imports (bundler style): resolve them to .ts.
registerHooks({
  resolve(specifier, context, next) {
    if (
      /^\.\.?\//.test(specifier) &&
      !/\.[cm]?[jt]sx?$/.test(specifier) &&
      context.parentURL?.includes('/src/')
    ) {
      return next(`${specifier}.ts`, context)
    }
    return next(specifier, context)
  },
})

const { checkoutMode, getProvider, providerFor, readPaymentConfig } =
  await import('../../src/features/payments/registry.ts')
const { testEvent, testProvider, testRef } =
  await import('../../src/features/payments/providers/test.ts')
const { WebhookVerificationError, isOrderStatus, isProviderId } =
  await import('../../src/features/payments/types.ts')
const { PAYMENTS_ENABLED, PLAN_PRICES, formatSen, planPrice, priceTable } =
  await import('../../src/features/plans/pricing.ts')
const { paymentsEn, paymentErrorsEn } = await import('../../src/i18n/dictionaries/payments/en.ts')
const { paymentsMs, paymentErrorsMs } = await import('../../src/i18n/dictionaries/payments/ms.ts')
const { paymentsRu, paymentErrorsRu } = await import('../../src/i18n/dictionaries/payments/ru.ts')

const PROD = { NODE_ENV: 'production' }

test('payments stay off in production code', () => {
  assert.equal(PAYMENTS_ENABLED, false)
  // Display prices only (owner, 2026-10-11): monthly Plus RM 9.90, VIP RM 19.90, nothing longer.
  assert.deepEqual(PLAN_PRICES.plus, { month: { amount: 9.9, currency: 'MYR' }, quarter: null, year: null })
  assert.deepEqual(PLAN_PRICES.vip, { month: { amount: 19.9, currency: 'MYR' }, quarter: null, year: null })
  // With checkout open only database prices count: no rows, no buy buttons.
  for (const periods of Object.values(priceTable([])))
    for (const price of Object.values(periods)) assert.equal(price, null)
})

test('registry: only adapters that exist are returned', () => {
  assert.equal(getProvider('test'), testProvider)
  for (const id of ['stripe', 'billplz', 'ipay88', 'paypal', '', null, undefined, 'TEST'])
    assert.equal(getProvider(id), null, String(id))
  assert.equal(isProviderId('billplz'), true)
  assert.equal(isProviderId('paypal'), false)
  assert.equal(isOrderStatus('refunded'), true)
  assert.equal(isOrderStatus('done'), false)
})

test('config: test gateway allowed outside production or with PAYMENT_TEST_MODE=true only', () => {
  assert.equal(readPaymentConfig(PROD).testAllowed, false)
  assert.equal(readPaymentConfig({ ...PROD, PAYMENT_TEST_MODE: 'false' }).testAllowed, false)
  assert.equal(readPaymentConfig({ ...PROD, PAYMENT_TEST_MODE: '1' }).testAllowed, false)
  assert.equal(readPaymentConfig({ ...PROD, PAYMENT_TEST_MODE: 'true' }).testAllowed, true)
  assert.equal(readPaymentConfig({ NODE_ENV: 'development' }).testAllowed, true)
  assert.equal(readPaymentConfig({ NODE_ENV: 'test' }).testAllowed, true)
})

test('config: PAYMENT_PROVIDER selects a live adapter, never the test one', () => {
  assert.equal(readPaymentConfig({ ...PROD, PAYMENT_PROVIDER: 'test' }).live, null)
  assert.equal(readPaymentConfig({ ...PROD, PAYMENT_PROVIDER: 'TEST' }).live, null)
  // Known gateway without an adapter yet: still off.
  assert.equal(readPaymentConfig({ ...PROD, PAYMENT_PROVIDER: 'stripe' }).live, null)
  assert.equal(readPaymentConfig({ ...PROD, PAYMENT_PROVIDER: 'nonsense' }).live, null)
  assert.equal(readPaymentConfig(PROD).live, null)
})

test('checkout mode: off for users, test for staff only when allowed', () => {
  const prod = readPaymentConfig(PROD)
  const testing = readPaymentConfig({ ...PROD, PAYMENT_TEST_MODE: 'true' })
  assert.deepEqual(checkoutMode(prod, { isStaff: false }, false), { kind: 'off' })
  assert.deepEqual(checkoutMode(prod, { isStaff: true }, false), { kind: 'off' })
  assert.deepEqual(checkoutMode(testing, { isStaff: false }, false), { kind: 'off' })
  assert.deepEqual(checkoutMode(testing, { isStaff: true }, false), { kind: 'test' })
  // PAYMENTS_ENABLED without a gateway adapter changes nothing for users.
  assert.deepEqual(checkoutMode(testing, { isStaff: false }, true), { kind: 'off' })
  assert.equal(providerFor({ kind: 'off' }), null)
  assert.equal(providerFor({ kind: 'test' }), testProvider)
})

test('checkout mode: live gateway for everyone once enabled', () => {
  const fake = { id: 'stripe', createCheckout: async () => ({}), verifyWebhook: async () => ({}) }
  const config = { live: fake, testAllowed: true }
  assert.deepEqual(checkoutMode(config, { isStaff: false }, true), { kind: 'live', provider: fake })
  assert.deepEqual(checkoutMode(config, { isStaff: true }, true), { kind: 'live', provider: fake })
  // Enabled flag off: staff fall back to the test gateway, users stay off.
  assert.deepEqual(checkoutMode(config, { isStaff: true }, false), { kind: 'test' })
  assert.deepEqual(checkoutMode(config, { isStaff: false }, false), { kind: 'off' })
  assert.equal(providerFor({ kind: 'live', provider: fake }), fake)
})

test('test gateway: in-app checkout, refuses webhooks, events look like verified ones', async () => {
  const id = '0b9f6c1e-3d2a-4c5b-8e7f-1a2b3c4d5e6f'
  const order = { id, userId: id, plan: 'vip', periodMonths: 3, amountSen: 12990, currency: 'MYR' }
  const checkout = await testProvider.createCheckout(order, {
    returnUrl: 'https://vibelydate.com/ms/plans/return?order=' + id,
    webhookUrl: 'https://vibelydate.com/api/payments/webhook/test',
    locale: 'ms',
    providerPriceId: null,
  })
  assert.deepEqual(checkout, {
    redirectUrl: `/ms/plans/checkout/test?order=${id}`,
    providerRef: testRef(id),
  })
  await assert.rejects(
    testProvider.verifyWebhook({ rawBody: '{}', headers: new Headers() }),
    (e) => e instanceof WebhookVerificationError,
  )
  const paid = testEvent({ id, amountSen: 12990, currency: 'MYR' }, 'paid', 'n1')
  assert.equal(paid.provider, 'test')
  assert.equal(paid.type, 'paid')
  assert.equal(paid.providerRef, `test_${id}`)
  assert.equal(paid.amountSen, 12990)
  assert.notEqual(
    paid.eventId,
    testEvent({ id, amountSen: 1, currency: 'MYR' }, 'paid', 'n2').eventId,
  )
  assert.equal(
    testEvent({ id, amountSen: 1, currency: 'MYR' }, 'failed', 'n').reason,
    'test failure',
  )
  // Never card data in the stored payload.
  assert.deepEqual(Object.keys(paid.payload).sort(), ['order', 'outcome'])
})

test('prices: database rows in sen over the static table', () => {
  const table = priceTable([
    { plan: 'plus', period_months: 1, amount_sen: 2990 },
    { plan: 'vip', period_months: 12, amount_sen: 39900 },
    { plan: 'free', period_months: 1, amount_sen: 100 },
    { plan: 'plus', period_months: 2, amount_sen: 100 },
  ])
  assert.deepEqual(planPrice('plus', 'month', table), { amount: 29.9, currency: 'MYR' })
  assert.deepEqual(planPrice('vip', 'year', table), { amount: 399, currency: 'MYR' })
  assert.equal(planPrice('plus', 'quarter', table), null)
  assert.equal(planPrice('vip', 'month', table), null)
  assert.deepEqual(planPrice('plus', 'month'), { amount: 9.9, currency: 'MYR' })
  assert.match(formatSen(2990), /^RM\s?29\.90$/)
  assert.match(formatSen(39900), /^RM\s?399$/)
})

test('dictionaries: the same keys in en, ms and ru', () => {
  const keys = (o, p = '') =>
    Object.entries(o)
      .flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]))
      .sort()
  assert.deepEqual(keys(paymentsMs), keys(paymentsEn))
  assert.deepEqual(keys(paymentsRu), keys(paymentsEn))
  assert.deepEqual(keys(paymentErrorsMs), keys(paymentErrorsEn))
  assert.deepEqual(keys(paymentErrorsRu), keys(paymentErrorsEn))
})
