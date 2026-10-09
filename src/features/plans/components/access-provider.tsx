'use client'

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  featureLimit,
  featureRemaining,
  FULL_ACCESS,
  hasFeature,
  isFeatureKey,
  upgradePlanFor,
  withUse,
  type Access,
  type FeatureKey,
} from '../access'
import type { Upgrade } from '../errors'
import { UpgradeSheet } from './upgrade-sheet'

type Ctx = {
  promise: Promise<Access>
  // Local use counts since the page loaded (likes, boosts): the server reads the real ones.
  uses: Partial<Record<FeatureKey, number>>
  recordUse: (key: FeatureKey) => void
  showUpgrade: (upgrade: Upgrade) => void
}

const AccessContext = createContext<Ctx | null>(null)

// Holds the viewer's access (my_access, one call per request) for the (main) layout and the one
// upgrade sheet every gated control opens. The promise is created on the server and read with
// use() under the pages' Suspense boundaries, so the layout itself never waits for it.
export function AccessProvider({
  access,
  children,
}: {
  access: Promise<Access>
  children: ReactNode
}) {
  const [uses, setUses] = useState<Ctx['uses']>({})
  const [upgrade, setUpgrade] = useState<Upgrade | null>(null)
  const recordUse = useCallback(
    (key: FeatureKey) => setUses((u) => ({ ...u, [key]: (u[key] ?? 0) + 1 })),
    [],
  )
  const value = useMemo(
    () => ({ promise: access, uses, recordUse, showUpgrade: setUpgrade }),
    [access, uses, recordUse],
  )
  return (
    <AccessContext value={value}>
      {children}
      <UpgradeSheet upgrade={upgrade} onClose={() => setUpgrade(null)} />
    </AccessContext>
  )
}

const resolvedFull = Promise.resolve(FULL_ACCESS)

// Plan, staff flag and helpers. Suspends until my_access() resolved (call it under Suspense).
// Outside the provider (tests, other trees) everything is allowed.
export function useAccess() {
  const ctx = use(AccessContext)
  const base = use(ctx?.promise ?? resolvedFull)
  const access = useMemo(() => {
    let a = base
    for (const [key, n] of Object.entries(ctx?.uses ?? {})) {
      if (!isFeatureKey(key)) continue
      for (let i = 0; i < (n ?? 0); i++) a = withUse(a, key)
    }
    return a
  }, [base, ctx?.uses])
  return {
    access,
    plan: access.plan,
    isStaff: access.isStaff,
    has: (key: FeatureKey) => hasFeature(access, key),
    limit: (key: FeatureKey) => featureLimit(access, key),
    remaining: (key: FeatureKey) => featureRemaining(access, key),
    upgradePlan: (key: FeatureKey) => upgradePlanFor(access, key),
    recordUse: ctx?.recordUse ?? (() => {}),
    showUpgrade: ctx?.showUpgrade ?? (() => {}),
  }
}

// For handlers that call a Server Action: opens the upgrade sheet when the result carries
// `upgrade` (VP402) and returns true, so the caller skips its own error message.
export function useUpgradeHandler() {
  const ctx = use(AccessContext)
  return useCallback(
    (result: { ok: boolean; upgrade?: { feature: string; reason: Upgrade['reason'] } }) => {
      if (result.ok || !result.upgrade || !isFeatureKey(result.upgrade.feature)) return false
      ctx?.showUpgrade({ feature: result.upgrade.feature, reason: result.upgrade.reason })
      return true
    },
    [ctx],
  )
}
