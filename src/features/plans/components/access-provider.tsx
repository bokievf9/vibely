'use client'

import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast, Toaster } from '@/components/ui/toast'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import { PromoSheet } from '@/features/promo/components/promo-sheet'
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
import { loadPaywall, registerPlanInterest } from '../actions'
import type { Catalog } from '../comparison'
import type { Upgrade } from '../errors'
import type { PaidPlan } from '../pricing'
import { UpgradeSheet } from './upgrade-sheet'

// The matrix for every plan, loaded when the upgrade sheet first opens (undefined = not yet,
// null = not readable: the sheet then shows the feature line and the buttons only).
type PaywallData = { catalog: Catalog | null } | undefined

type Ctx = {
  promise: Promise<Access>
  // Local use counts since the page loaded (likes, boosts): the server reads the real ones.
  uses: Partial<Record<FeatureKey, number>>
  recordUse: (key: FeatureKey) => void
  showUpgrade: (upgrade: Upgrade) => void
  openPromo: () => void
  paywall: PaywallData
  // Plans the viewer asked to hear about (plan_interest), from the server or tapped here.
  interest: ReadonlySet<PaidPlan>
  addInterest: (plans: PaidPlan[]) => void
}

const AccessContext = createContext<Ctx | null>(null)

// Holds the viewer's access (my_access, one call per request) for the (main) layout, the one
// upgrade sheet every gated control opens, the promo code sheet and the toast. The promise is
// created on the server and read with use() under the pages' Suspense boundaries, so the layout
// itself never waits for it.
export function AccessProvider({
  access,
  children,
}: {
  access: Promise<Access>
  children: ReactNode
}) {
  const [uses, setUses] = useState<Ctx['uses']>({})
  const [upgrade, setUpgrade] = useState<Upgrade | null>(null)
  const [promoOpen, setPromoOpen] = useState(false)
  const [paywall, setPaywall] = useState<PaywallData>(undefined)
  const [interest, setInterest] = useState<ReadonlySet<PaidPlan>>(() => new Set())
  const loading = useRef(false)

  const recordUse = useCallback(
    (key: FeatureKey) => setUses((u) => ({ ...u, [key]: (u[key] ?? 0) + 1 })),
    [],
  )
  const addInterest = useCallback(
    (plans: PaidPlan[]) =>
      setInterest((s) => (plans.every((p) => s.has(p)) ? s : new Set([...s, ...plans]))),
    [],
  )
  const showUpgrade = useCallback(
    (next: Upgrade) => {
      setUpgrade(next)
      if (loading.current) return
      loading.current = true
      void loadPaywall()
        .then((result) => {
          // A failure shows the sheet without the matrix and tries again on the next open.
          if (!result.ok || !result.data.catalog) loading.current = false
          setPaywall({ catalog: result.ok ? result.data.catalog : null })
          if (result.ok) addInterest(result.data.interest)
        })
        .catch(() => {
          loading.current = false
          setPaywall((p) => p ?? { catalog: null })
        })
    },
    [addInterest],
  )
  const openPromo = useCallback(() => {
    setUpgrade(null)
    setPromoOpen(true)
  }, [])

  const value = useMemo(
    () => ({
      promise: access,
      uses,
      recordUse,
      showUpgrade,
      openPromo,
      paywall,
      interest,
      addInterest,
    }),
    [access, uses, recordUse, showUpgrade, openPromo, paywall, interest, addInterest],
  )
  return (
    <AccessContext value={value}>
      {children}
      <UpgradeSheet upgrade={upgrade} onClose={() => setUpgrade(null)} />
      <PromoSheet open={promoOpen} onClose={() => setPromoOpen(false)} />
      <Toaster />
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

// Without suspending: the sheet and the plans screen (no my_access needed).
export function usePaywall() {
  const ctx = use(AccessContext)
  return {
    paywall: ctx?.paywall,
    openPromo: ctx?.openPromo ?? (() => {}),
  }
}

// "Notify me when it launches": whether the viewer already asked for a plan, and the tap.
// `known` seeds it from the server (the Plans screen reads plan_interest itself).
export function usePlanInterest(known: readonly PaidPlan[] = []) {
  const ctx = use(AccessContext)
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [pending, setPending] = useState<PaidPlan | null>(null)
  const interested = (plan: PaidPlan) => known.includes(plan) || (ctx?.interest.has(plan) ?? false)
  const register = async (plan: PaidPlan) => {
    if (pending || interested(plan)) return
    setPending(plan)
    try {
      const result = await registerPlanInterest(plan)
      if (!result.ok) {
        toast(errorText(result.error) ?? dict.errors.generic, 'error')
        return
      }
      ctx?.addInterest([plan])
      toast(fmt(dict.plans.screen.notifiedToast, { plan: dict.plans.names[plan] }))
    } catch {
      toast(dict.errors.generic, 'error')
    } finally {
      setPending(null)
    }
  }
  return { interested, register, pending }
}
