'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { useAccess } from '@/features/plans/components/access-provider'
import { acceptCallsNotice, loadCallSettings, setCallsAllowed } from '../settings-actions'
import type { CallKind, CallSettings } from '../types'
import { CallsSheet } from './calls-sheet'
import { onCallPermission, requestCall } from './call-signal'

type Props = { matchId: string; partnerName: string; initial: CallSettings }

// Phone icon in the chat header. Looks disabled until both participants allowed calls; tapping it
// always opens the sheet with the permission switch. Only people with the calls feature (VIP or
// staff) get the call buttons; everyone else can still allow calls and accept them
// (20261009000280: only the caller needs the feature).
export function ChatCallButton({ matchId, partnerName, initial }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [settings, setSettings] = useState(initial)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'settings' | 'notice'>('settings')
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const both = settings.meAllowed && settings.partnerAllowed
  const { has } = useAccess()
  const canCall = has('calls')

  const refresh = useCallback(async () => {
    const result = await loadCallSettings(matchId)
    if (result.ok) setSettings(result.data)
  }, [matchId])

  useEffect(
    () =>
      onCallPermission((d) => {
        if (d.matchId === matchId) void refresh()
      }),
    [matchId, refresh],
  )

  const save = async (allowed: boolean) => {
    const result = await setCallsAllowed({ matchId, allowed })
    if (!result.ok) return setError(result.error)
    setError(undefined)
    setSettings(result.data)
  }

  const toggle = () => {
    if (!settings.meAllowed && !settings.consented) return setStep('notice')
    startTransition(() => save(!settings.meAllowed))
  }

  // The one-time recording notice: accepted, then calls are turned on for this chat.
  const acceptNotice = () =>
    startTransition(async () => {
      const result = await acceptCallsNotice()
      if (!result.ok) return setError(result.error)
      setStep('settings')
      await save(true)
    })

  // Runs inside the tap: the call layer starts the call right away.
  const call = (kind: CallKind) => {
    setOpen(false)
    requestCall({ matchId, kind })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={dict.calls.settingsTitle}
        onClick={() => {
          setStep('settings')
          setOpen(true)
        }}
      >
        <Phone className={cn('size-6', !both && 'opacity-40')} />
      </Button>
      <CallsSheet
        open={open}
        step={step}
        settings={settings}
        partnerName={partnerName}
        canCall={canCall}
        pending={pending}
        error={errorText(error)}
        onClose={() => setOpen(false)}
        onToggle={toggle}
        onAcceptNotice={acceptNotice}
        onCall={call}
      />
    </>
  )
}
