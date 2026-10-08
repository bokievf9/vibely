'use client'

import { useEffect, useState, useTransition } from 'react'
import { Footprints } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { pressableRow } from '@/features/settings/components/switch-row'
import { setCrossedPaths } from '../actions'
import { CrossedPathsSheet } from './crossed-paths-sheet'

// Settings → Privacy. Turning on goes through the explanation sheet; turning off deletes the
// history at once (server side).
export function CrossedPathsToggle({ initial }: { initial: boolean }) {
  const { dict } = useI18n()
  const t = dict.crossed
  const errorText = useErrorText()
  const [on, setOn] = useState(initial)
  const [sheet, setSheet] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const [noPermission, setNoPermission] = useState(false)

  useEffect(() => {
    if (!on || !navigator.permissions?.query) return
    let cancelled = false
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => !cancelled && setNoPermission(s.state !== 'granted'))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [on])

  const toggle = () => {
    if (!on) return setSheet(true)
    startTransition(async () => {
      setOn(false)
      const result = await setCrossedPaths(false)
      if (!result.ok) {
        setOn(true)
        return setError(result.error)
      }
      setError(undefined)
    })
  }

  const note = error ? errorText(error) : on && noPermission ? t.noPermission : t.settingHint
  return (
    <>
      <div {...pressableRow(toggle, pending)}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <Footprints className="size-5 shrink-0" aria-hidden />
            <span className="min-w-0">{t.setting}</span>
          </span>
          <Switch checked={on} onToggle={toggle} label={t.setting} disabled={pending} />
        </div>
        <p className={cn('text-sm', error ? 'text-danger' : 'text-muted')}>{note}</p>
      </div>
      <CrossedPathsSheet
        open={sheet}
        onClose={() => setSheet(false)}
        onEnabled={() => setOn(true)}
      />
    </>
  )
}
