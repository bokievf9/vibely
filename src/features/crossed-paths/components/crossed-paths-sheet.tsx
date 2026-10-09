'use client'

import { useState, useTransition } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { setCrossedPaths } from '../actions'
import { resetCrossedPathsPing } from './crossed-paths-pinger'

type Props = { open: boolean; onClose: () => void; onEnabled: () => void }

// Shown before turning Crossed paths on: exactly what is sent, stored, shown and for how long.
export function CrossedPathsSheet({ open, onClose, onEnabled }: Props) {
  const { dict } = useI18n()
  const t = dict.crossed
  const errorText = useErrorText()
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const turnOn = () =>
    startTransition(async () => {
      const result = await setCrossedPaths(true)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      resetCrossedPathsPing()
      onEnabled()
      onClose()
    })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.sheetTitle}
      footer={
        <div className="flex flex-col gap-2">
          <Button fullWidth loading={pending} onClick={turnOn}>
            {t.turnOn}
          </Button>
          <Button variant="ghost" fullWidth disabled={pending} onClick={onClose}>
            {t.notNow}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p>{t.sheetIntro}</p>
        <ul className="flex flex-col gap-3">
          {t.sheetPoints.map((point) => (
            <li key={point} className="flex gap-3 text-sm">
              <ShieldCheck className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted text-sm">{t.sheetBlocked}</p>
        <FormError message={errorText(error)} />
      </div>
    </Modal>
  )
}
