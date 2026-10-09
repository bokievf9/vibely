'use client'

import { useState, useTransition } from 'react'
import { EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { setIncognito } from '../actions'
import { useUpgradeHandler } from '@/features/plans/components/access-provider'

type Props = { open: boolean; onClose: () => void; onEnabled: () => void }

// Shown before turning Incognito on: who can still see the profile and what keeps working.
export function IncognitoSheet({ open, onClose, onEnabled }: Props) {
  const { dict } = useI18n()
  const t = dict.incognito
  const errorText = useErrorText()
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const upgradeOr = useUpgradeHandler()

  const turnOn = () =>
    startTransition(async () => {
      const result = await setIncognito(true)
      if (!result.ok) {
        if (upgradeOr(result)) return onClose()
        return setError(result.error)
      }
      setError(undefined)
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
        <p className="text-headline">{t.sheetIntro}</p>
        <ul className="flex flex-col gap-3">
          {t.sheetPoints.map((point) => (
            <li key={point} className="flex gap-3 text-sm">
              <EyeOff className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted text-sm">{t.sheetNote}</p>
        <FormError message={errorText(error)} />
      </div>
    </Modal>
  )
}
