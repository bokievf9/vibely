'use client'

import { Bell } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { publicEnv } from '@/lib/env'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { pressableRow } from '@/features/settings/components/switch-row'
import { usePush } from '../use-push'

// Settings → Notifications: this device's push subscription. Hidden when Web Push is not
// configured on the server. Renders a row; the caller provides the section and card.
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

  const toggle = () => void (on ? disable() : enable())

  return (
    <div {...pressableRow(toggle, !available || busy)}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <Bell className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0">{dict.push.toggle}</span>
        </span>
        <Switch
          checked={on}
          label={dict.push.toggle}
          disabled={!available || busy}
          onToggle={toggle}
        />
      </div>
      <p className={cn('text-sm', failed ? 'text-red-400' : 'text-muted')}>{note}</p>
    </div>
  )
}
