'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { Eye } from 'lucide-react'
import { useErrorText, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { setShowLastSeen } from '../actions'

// Own profile → Privacy. Telegram-like: hiding your last seen also hides everyone else's.
export function LastSeenToggle({ initial }: { initial: boolean }) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [saved, setSaved] = useState(initial)
  const [on, setOptimistic] = useOptimistic(saved)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const toggle = () =>
    startTransition(async () => {
      const next = !on
      setOptimistic(next)
      const result = await setShowLastSeen(next)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setSaved(next)
    })

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-muted text-sm font-medium">{dict.chats.privacyTitle}</h2>
      <div className="bg-surface border-border flex flex-col gap-2 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-medium">
            <Eye className="size-5" aria-hidden /> {dict.chats.showLastSeen}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={dict.chats.showLastSeen}
            disabled={pending}
            onClick={toggle}
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
        <p className={cn('text-sm', error ? 'text-red-400' : 'text-muted')}>
          {error ? errorText(error) : dict.chats.showLastSeenHint}
        </p>
      </div>
    </section>
  )
}
