'use client'

import { useEffect, useState, useTransition } from 'react'
import { Lock, Rocket } from 'lucide-react'
import { groupedRowClassName } from '@/components/ui/grouped'
import { Spinner } from '@/components/ui/spinner'
import { fmt } from '@/i18n/config'
import { formatTime } from '@/i18n/format'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { activateBoost } from '../actions'
import { useAccess, useUpgradeHandler } from './access-provider'

// Own profile → Boost: 30 minutes first in Discover. Plus gets one per month, VIP one per week;
// without the feature (or with the quota used) the row opens the upgrade sheet.
export function BoostRow() {
  const { dict, locale } = useI18n()
  const t = dict.plans
  const errorText = useErrorText()
  const { access, has, remaining, recordUse, showUpgrade, upgradePlan } = useAccess()
  const upgradeOr = useUpgradeHandler()
  const [until, setUntil] = useState(access.boostUntil)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  // The server only sends a running boost; it switches off here when it ends.
  useEffect(() => {
    if (!until) return
    const id = setTimeout(() => setUntil(null), Math.max(0, Date.parse(until) - Date.now()))
    return () => clearTimeout(id)
  }, [until])
  // Not deployed yet (my_access missing): no boost to offer.
  if (!access.available) return null

  const active = until !== null
  const left = remaining('boost')
  const period = access.features.boost?.period

  const tap = () => {
    if (active || pending) return
    if (!has('boost')) return showUpgrade({ feature: 'boost', reason: 'feature' })
    if (left === 0) return showUpgrade({ feature: 'boost', reason: 'limit' })
    startTransition(async () => {
      const result = await activateBoost()
      if (!result.ok) return upgradeOr(result) ? setError(undefined) : setError(result.error)
      setError(undefined)
      recordUse('boost')
      setUntil(result.data)
    })
  }

  const hint = error
    ? errorText(error)
    : active && until
      ? fmt(t.boostActive, { time: formatTime(until, locale) })
      : has('boost') && left !== null && period
        ? `${t.boostHint} ${fmt(t.boostLeft, { count: left, period: t.periods[period] })}`
        : has('boost')
          ? t.boostHint
          : `${t.boostHint} ${fmt(t.availableIn, { plan: t.names[upgradePlan('boost')] })}.`

  return (
    <button
      type="button"
      onClick={tap}
      aria-disabled={active || pending || undefined}
      className={cn(groupedRowClassName, 'text-left')}
    >
      <span className={cn('icon-tile', active && 'bg-accent text-accent-foreground')}>
        <Rocket className="size-[1.125rem]" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{t.boost}</span>
        <span
          className={cn(
            'text-footnote font-normal text-pretty',
            error ? 'text-danger' : active ? 'text-accent' : 'text-muted',
          )}
        >
          {hint}
        </span>
      </span>
      {pending && <Spinner className="size-5 shrink-0" />}
      {!pending && !has('boost') && <Lock className="text-muted size-4 shrink-0" aria-hidden />}
    </button>
  )
}
