'use client'

import { useOptimistic, useState, useTransition, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useErrorText } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import type { UserResult } from '@/i18n/errors'
import { cn } from '@/lib/utils'

// A switch that saves through a Server Action: flips instantly, rolls back on error.
export function useSavedToggle(initial: boolean, save: (next: boolean) => Promise<UserResult>) {
  const [saved, setSaved] = useState(initial)
  const [on, setOptimistic] = useOptimistic(saved)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const toggle = () =>
    startTransition(async () => {
      const next = !on
      setOptimistic(next)
      const result = await save(next)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setSaved(next)
    })
  return { on, pending, error, toggle }
}

type RowProps = {
  label: string
  icon?: LucideIcon
  hint?: ReactNode
  initial: boolean
  save: (next: boolean) => Promise<UserResult>
}

// One settings row: icon + label, the switch, and an optional hint (replaced by the error).
export function SwitchRow({ label, icon: Icon, hint, initial, save }: RowProps) {
  const errorText = useErrorText()
  const { on, pending, error, toggle } = useSavedToggle(initial, save)
  const note = error ? errorText(error) : hint
  return (
    <div className="flex flex-col gap-1.5 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-medium">
          {Icon && <Icon className="size-5 shrink-0" aria-hidden />} {label}
        </span>
        <Switch checked={on} onToggle={toggle} label={label} disabled={pending} />
      </div>
      {note && <p className={cn('text-sm', error ? 'text-red-400' : 'text-muted')}>{note}</p>}
    </div>
  )
}
