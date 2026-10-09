import type { ErrorKey } from '@/i18n/dictionaries/en'
import type { FeatureKey } from './access'

// Every plan gate in the database raises SQLSTATE VP402 with detail = feature key and hint =
// 'feature' (not in the plan), 'limit' (quota of the period used up) or 'partner' (the other
// person's plan, calls only). Server Actions return it as an ErrorKey plus `upgrade`, which the
// client turns into <UpgradeCard>.
export const PLAN_SQLSTATE = 'VP402'

export type UpgradeReason = 'feature' | 'limit' | 'partner'
export type Upgrade = { feature: FeatureKey; reason: UpgradeReason }

type DbError = { code?: string; details?: string | null; hint?: string | null } | null | undefined

// The key is checked against the known keys on the client (useUpgradeHandler); this module has
// no runtime imports so it also loads in the unit tests.
const KEY_RE = /^[a-z0-9_]{2,40}$/

export function upgradeFromError(error: DbError): Upgrade | null {
  if (!error || error.code !== PLAN_SQLSTATE || !error.details || !KEY_RE.test(error.details)) {
    return null
  }
  const reason: UpgradeReason =
    error.hint === 'limit' ? 'limit' : error.hint === 'partner' ? 'partner' : 'feature'
  return { feature: error.details as FeatureKey, reason }
}

const REASON_KEYS: Record<UpgradeReason, ErrorKey> = {
  feature: 'planRequired',
  limit: 'planLimit',
  partner: 'planPartner',
}

// The failure to return from a Server Action when the database said "plan required", else null.
export function planFail(error: DbError): { ok: false; error: ErrorKey; upgrade: Upgrade } | null {
  const upgrade = upgradeFromError(error)
  return upgrade ? { ok: false, error: REASON_KEYS[upgrade.reason], upgrade } : null
}
