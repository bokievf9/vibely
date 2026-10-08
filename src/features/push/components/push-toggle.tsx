'use client'

import { Bell } from 'lucide-react'
import { publicEnv } from '@/lib/env'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { usePush } from '../use-push'

// Own profile → Notifications. Hidden when Web Push is not configured on the server.
export function PushToggle() {
  if (!publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return null
  return <Toggle />
}

function Toggle() {
  const { dict } = useI18n()
  const { status, busy, failed, enable, disable } = usePush({ sync: true })
  const on = status === 'on'
  const available = status === 'on' || status === 'off'
  const note =
    status === 'blocked'
      ? dict.push.blocked
      : status === 'unsupported'
        ? dict.push.unsupported
        : status === 'ios-install'
          ? dict.push.iosInstall
          : failed
            ? dict.push.failed
            : dict.push.hint

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-muted text-sm font-medium">{dict.push.title}</h2>
      <div className="bg-surface border-border flex flex-col gap-2 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-medium">
            <Bell className="size-5" aria-hidden /> {dict.push.toggle}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={dict.push.toggle}
            disabled={!available || busy}
            onClick={() => void (on ? disable() : enable())}
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
        <p className={cn('text-sm', failed ? 'text-red-400' : 'text-muted')}>{note}</p>
      </div>
    </section>
  )
}
