'use client'

import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { publicEnv } from '@/lib/env'
import { useI18n } from '@/i18n/client'
import { readFlag, writeFlag } from '@/features/pwa/platform'
import { usePush } from '../use-push'

const PROMPTED_KEY = 'vibely_push_prompted'

// Shown once, after the first match: asking before the browser prompt keeps "Block" rare.
export function PushSoftPrompt() {
  if (!publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return null
  return <Prompt />
}

function Prompt() {
  const { dict } = useI18n()
  const { status, busy, failed, enable } = usePush()
  const [eligible, setEligible] = useState(false)

  useEffect(() => {
    if (status !== 'off') return
    let active = true
    // Decide once per mount; the flag makes it a one-time prompt across sessions.
    void Promise.resolve(readFlag(PROMPTED_KEY)).then((seen) => {
      if (!active || seen) return
      writeFlag(PROMPTED_KEY)
      setEligible(true)
    })
    return () => {
      active = false
    }
  }, [status])

  if (!eligible || status === 'on') return null
  return (
    <div className="border-border flex w-full flex-col gap-3 rounded-2xl border p-4 text-left">
      <p className="flex items-center gap-2 text-sm font-medium">
        <BellRing className="text-accent size-5 shrink-0" aria-hidden /> {dict.push.promptText}
      </p>
      {failed || status === 'blocked' ? (
        <p className="text-sm text-red-400">
          {status === 'blocked' ? dict.push.blocked : dict.push.failed}
        </p>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="h-11"
          loading={busy}
          onClick={() => void enable()}
        >
          {dict.push.promptButton}
        </Button>
      )}
    </div>
  )
}
