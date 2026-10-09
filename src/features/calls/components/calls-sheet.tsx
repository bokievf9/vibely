'use client'

import { Phone, ShieldAlert, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { CallKind, CallSettings } from '../types'

type Props = {
  open: boolean
  step: 'settings' | 'notice'
  settings: CallSettings
  partnerName: string
  // Starting a call needs the calls feature; without it the sheet only has the switch.
  canCall: boolean
  pending: boolean
  error?: string
  onClose: () => void
  onToggle: () => void
  onAcceptNotice: () => void
  onCall: (kind: CallKind) => void
}

// "Calls in this chat": the mutual permission switch, the recording reminder and the call
// buttons (enabled only when both allowed). Turning calls on the first time shows the one-time
// recording notice, which must be accepted.
export function CallsSheet(props: Props) {
  const { dict } = useI18n()
  const t = dict.calls
  const { settings } = props
  const both = settings.meAllowed && settings.partnerAllowed

  if (props.step === 'notice') {
    return (
      <Modal open={props.open} onClose={props.onClose} title={t.noticeTitle}>
        <div className="flex flex-col gap-4">
          <ShieldAlert className="text-accent size-10" aria-hidden />
          <p className="text-lg font-semibold">{t.noticeText}</p>
          <p className="text-muted text-sm">{t.noticeDetails}</p>
          <LocaleLink href="/privacy" className="text-accent text-sm underline">
            {t.privacy}
          </LocaleLink>
          {props.error && <p className="text-danger text-sm">{props.error}</p>}
          <Button fullWidth loading={props.pending} onClick={props.onAcceptNotice}>
            {t.noticeAccept}
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={props.open} onClose={props.onClose} title={t.settingsTitle}>
      <div className="flex flex-col gap-4">
        <div className="bg-background border-border flex flex-col gap-2 rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{t.allow}</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.meAllowed}
              aria-label={t.allow}
              disabled={props.pending}
              onClick={props.onToggle}
              className={cn(
                'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50',
                settings.meAllowed ? 'bg-accent' : 'bg-white/[0.14]',
              )}
            >
              <span
                className={cn(
                  'absolute top-1 left-1 size-5 rounded-full bg-neutral-50 shadow-sm transition-transform duration-200 ease-out',
                  settings.meAllowed && 'translate-x-5',
                )}
              />
            </button>
          </div>
          <p className="text-muted text-sm">{t.allowHint}</p>
        </div>
        <p className="text-sm font-medium" aria-live="polite">
          {both
            ? t.bothAllowed
            : settings.meAllowed
              ? fmt(t.waitingPartner, { name: props.partnerName })
              : null}
        </p>
        <p className="text-muted flex items-center gap-2 text-xs">
          <span className="size-2 shrink-0 rounded-full bg-red-500" aria-hidden />
          {t.noticeText}
        </p>
        {props.error && <p className="text-danger text-sm">{props.error}</p>}
        {props.canCall ? (
          <div className="flex gap-3">
            <Button fullWidth disabled={!both} onClick={() => props.onCall('audio')}>
              <Phone className="size-5" /> {t.audio}
            </Button>
            <Button fullWidth disabled={!both} onClick={() => props.onCall('video')}>
              <Video className="size-5" /> {t.video}
            </Button>
          </div>
        ) : (
          <p className="text-muted text-sm">{t.acceptOnly}</p>
        )}
      </div>
    </Modal>
  )
}
