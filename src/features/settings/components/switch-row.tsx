'use client'

import { useOptimistic, useState, useTransition, type MouseEvent, type ReactNode } from 'react'
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
    <div {...pressableRow(toggle, pending)}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          {Icon && <Icon className="size-5 shrink-0" aria-hidden />}
          <span className="min-w-0">{label}</span>
        </span>
        <Switch checked={on} onToggle={toggle} label={label} disabled={pending} />
      </div>
      {note && <p className={cn('text-sm', error ? 'text-danger' : 'text-muted')}>{note}</p>}
    </div>
  )
}

// The whole row is the tap target (the switch alone is 28px tall) and darkens on press.
// The switch stays the one accessible control, so a tap on it is not counted twice.
export function pressableRow(toggle: () => void, disabled: boolean) {
  return {
    className: cn(
      'flex flex-col gap-1.5 p-4 transition-colors',
      !disabled && 'cursor-pointer active:bg-border/50',
    ),
    onClick: (e: MouseEvent<HTMLDivElement>) => {
      if (disabled || (e.target as HTMLElement).closest('[role="switch"], a, button')) return
      toggle()
    },
  }
}
