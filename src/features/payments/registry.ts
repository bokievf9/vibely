import { testProvider } from './providers/test'
import { isProviderId, type PaymentProvider, type PaymentProviderId } from './types'

// The adapters that exist. Adding a gateway = one file in ./providers plus one line here
// (docs/payments.md). Until then 'stripe', 'billplz' and 'ipay88' are known ids without adapters,
// so selecting one keeps checkout off instead of failing at runtime.
const ADAPTERS: Partial<Record<PaymentProviderId, PaymentProvider>> = {
  test: testProvider,
}

export function getProvider(id: string | null | undefined): PaymentProvider | null {
  if (!isProviderId(id)) return null
  return ADAPTERS[id] ?? null
}

export type PaymentEnv = {
  NODE_ENV?: string
  PAYMENT_PROVIDER?: string
  PAYMENT_TEST_MODE?: string
}

export type PaymentConfig = {
  // The live gateway from PAYMENT_PROVIDER when it has an adapter ('test' is never live).
  live: PaymentProvider | null
  // The fake gateway may be offered (to staff only): outside production, or PAYMENT_TEST_MODE=true.
  testAllowed: boolean
}

export function readPaymentConfig(env: PaymentEnv): PaymentConfig {
  const id = env.PAYMENT_PROVIDER?.trim().toLowerCase()
  const live = id && id !== 'test' ? getProvider(id) : null
  return {
    live,
    testAllowed: env.NODE_ENV !== 'production' || env.PAYMENT_TEST_MODE?.trim() === 'true',
  }
}

export type CheckoutMode =
  { kind: 'live'; provider: PaymentProvider } | { kind: 'test' } | { kind: 'off' }

// Who can check out, and through which gateway:
//   * live: payments switched on in code (PAYMENTS_ENABLED) and a configured gateway adapter;
//     any signed-in verified user (the database checks verification and bans again).
//   * test: otherwise, staff only, when the test gateway is allowed.
//   * off: everyone else ("Coming soon").
export function checkoutMode(
  config: PaymentConfig,
  viewer: { isStaff: boolean },
  paymentsEnabled: boolean,
): CheckoutMode {
  if (paymentsEnabled && config.live) return { kind: 'live', provider: config.live }
  if (viewer.isStaff && config.testAllowed) return { kind: 'test' }
  return { kind: 'off' }
}

export function providerFor(mode: CheckoutMode): PaymentProvider | null {
  if (mode.kind === 'live') return mode.provider
  if (mode.kind === 'test') return testProvider
  return null
}
