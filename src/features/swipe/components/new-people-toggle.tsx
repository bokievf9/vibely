'use client'

import { useState } from 'react'
import { BellPlus } from 'lucide-react'
import { publicEnv } from '@/lib/env'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { usePush } from '@/features/push/use-push'
import { setNewPeopleAlert } from '../deck-end-actions'
import type { SwipeFilters } from '../schemas'

type Props = { initialOn: boolean; filters: SwipeFilters; onChange: (on: boolean) => void }

// Opt-in push when a newly verified person matches these filters. Needs Web Push on the server.
export function NewPeopleToggle(props: Props) {
  if (!publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return null
  return <Toggle {...props} />
}

function Toggle({ initialOn, filters, onChange }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const push = usePush()
  const [on, setOn] = useState(initialOn)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const blocked =
    push.status === 'blocked' || push.status === 'unsupported' || push.status === 'ios-install'

  const toggle = async () => {
    setBusy(true)
    setError(undefined)
    // Turning on also subscribes this device, otherwise there is nothing to deliver to.
    const ready = on || push.status === 'on' || (await push.enable())
    const result = ready ? await setNewPeopleAlert({ enabled: !on, filters }) : null
    setBusy(false)
    if (!result) return
    if (!result.ok) return setError(result.error)
    setOn(result.data)
    onChange(result.data)
  }

  const note =
    push.status === 'blocked'
      ? dict.push.blocked
      : push.status === 'ios-install'
        ? dict.push.iosInstall
        : push.failed
          ? dict.push.failed
          : (errorText(error) ?? dict.discover.notifyHint)

  return (
    <div className="bg-surface border-border flex flex-col gap-2 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-medium">
          <BellPlus className="text-accent size-5" aria-hidden /> {dict.discover.notify}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={dict.discover.notify}
          disabled={busy || push.busy || (blocked && !on) || push.status === 'loading'}
          onClick={() => void toggle()}
          className={cn(
            'relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50',
            on ? 'bg-accent' : 'bg-border',
          )}
        >
          <span
            className={cn(
              'absolute top-1 left-1 size-5 rounded-full bg-white transition-transform',
              on && 'translate-x-5',
            )}
          />
        </button>
      </div>
      <p className={cn('text-sm', error || push.failed ? 'text-danger' : 'text-muted')}>{note}</p>
    </div>
  )
}
