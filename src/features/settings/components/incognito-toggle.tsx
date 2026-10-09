'use client'

import { useState, useTransition } from 'react'
import { EyeOff } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { setIncognito } from '../actions'
import { IncognitoSheet } from './incognito-sheet'
import { pressableRow } from './switch-row'
import { fmt } from '@/i18n/config'
import { useAccess } from '@/features/plans/components/access-provider'

// Settings → Privacy. Turning on goes through the explanation sheet; turning off is immediate.
export function IncognitoToggle({ initial }: { initial: boolean }) {
  const { dict } = useI18n()
  const t = dict.incognito
  const errorText = useErrorText()
  const [on, setOn] = useState(initial)
  const [sheet, setSheet] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  // Plus (20261009000280). After a downgrade the switch stays on but counts as off until the plan
  // includes it again; it can always be switched off.
  const { has, upgradePlan, showUpgrade } = useAccess()
  const allowed = has('incognito')

  const toggle = () => {
    if (!on && !allowed) return showUpgrade({ feature: 'incognito', reason: 'feature' })
    if (!on) return setSheet(true)
    startTransition(async () => {
      setOn(false)
      const result = await setIncognito(false)
      if (!result.ok) {
        setOn(true)
        return setError(result.error)
      }
      setError(undefined)
    })
  }

  return (
    <>
      <div {...pressableRow(toggle, pending)}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3 text-[16px] font-medium tracking-[-0.01em]">
            <span className="icon-tile">
              <EyeOff className="size-[1.125rem]" aria-hidden />
            </span>
            <span className="min-w-0">{t.setting}</span>
          </span>
          <Switch checked={on} onToggle={toggle} label={t.setting} disabled={pending} />
        </div>
        <p className={cn('text-sm', error ? 'text-danger' : 'text-muted')}>
          {error
            ? errorText(error)
            : allowed
              ? t.settingHint
              : fmt(dict.plans.availableIn, { plan: dict.plans.names[upgradePlan('incognito')] })}
        </p>
      </div>
      <IncognitoSheet open={sheet} onClose={() => setSheet(false)} onEnabled={() => setOn(true)} />
    </>
  )
}
