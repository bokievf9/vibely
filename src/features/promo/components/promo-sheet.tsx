'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { redeemPromo } from '../actions'
import { isValidPromoCode, type PromoOutcome } from '../schemas'
import { PerksSheet } from './perks-sheet'

// The promo code sheet (Settings → Promo code, the Plans screen, the upgrade sheet). After a
// success the perks sheet lists what the code unlocked and the page is refreshed.
export function PromoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dict } = useI18n()
  const t = dict.promo
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<ErrorKey>()
  const [outcome, setOutcome] = useState<PromoOutcome | null>(null)
  const [busy, startBusy] = useTransition()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!isValidPromoCode(code)) return setError('promoFormat')
    startBusy(async () => {
      const result = await redeemPromo({ code })
      if (!result.ok) return setError(result.error)
      setError(undefined)
      onClose()
      setCode('')
      setOutcome(result.data)
    })
  }

  const close = () => {
    if (busy) return
    onClose()
    setError(undefined)
  }

  return (
    <>
      <Modal open={open} onClose={close} title={t.title}>
        <form onSubmit={submit} className="flex flex-col gap-4 pb-1" noValidate>
          <p className="text-muted text-callout">{t.intro}</p>
          <Field label={t.label} htmlFor="promo-code" error={errorText(error)}>
            <Input
              id="promo-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setError(undefined)
              }}
              placeholder={t.placeholder}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={40}
              aria-invalid={error ? true : undefined}
              aria-describedby="promo-code-msg"
              className="font-mono tracking-[0.08em] uppercase"
            />
          </Field>
          <Button type="submit" fullWidth loading={busy} disabled={code.trim().length < 3}>
            {t.apply}
          </Button>
        </form>
      </Modal>

      <PerksSheet
        outcome={outcome}
        onClose={() => {
          setOutcome(null)
          router.refresh()
        }}
      />
    </>
  )
}
