'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { ChevronRight, Ticket } from 'lucide-react'
import { VipBadge } from '@/components/ui/vip-badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { groupedRowClassName } from '@/components/ui/grouped'
import { fmt } from '@/i18n/config'
import { formatDay } from '@/i18n/format'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { redeemPromo } from '../actions'
import type { VipStatus } from '../queries'
import { isValidPromoCode, type PromoOutcome } from '../schemas'
import { PerksSheet } from './perks-sheet'

// Settings → Promo code: the current VIP state (or a hint) and a sheet to enter a code.
// After a success the success sheet lists the perks and the page is refreshed.
export function PromoSettingsRow({ initial }: { initial: VipStatus }) {
  const { dict, locale } = useI18n()
  const t = dict.promo
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<ErrorKey>()
  const [outcome, setOutcome] = useState<PromoOutcome | null>(null)
  const [busy, startBusy] = useTransition()

  const status =
    initial.plan !== 'free' && initial.planUntil
      ? fmt(dict.plans.rowUntil, {
          plan: dict.plans.names[initial.plan],
          date: formatDay(initial.planUntil, locale),
        })
      : initial.plan !== 'free'
        ? dict.plans.names[initial.plan]
        : initial.pending > 0
          ? t.pendingHint
          : t.rowHint
  const boost = initial.boostUntil
    ? fmt(t.boostUntil, { date: formatDay(initial.boostUntil, locale) })
    : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!isValidPromoCode(code)) return setError('promoFormat')
    startBusy(async () => {
      const result = await redeemPromo({ code })
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setOpen(false)
      setCode('')
      setOutcome(result.data)
    })
  }

  const close = () => {
    if (busy) return
    setOpen(false)
    setError(undefined)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={groupedRowClassName + ' text-left'}
      >
        <span className="icon-tile">
          {initial.isVip ? (
            <VipBadge size={18} />
          ) : (
            <Ticket className="size-[1.125rem]" aria-hidden />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{t.row}</span>
          <span className="text-muted text-footnote font-normal">{status}</span>
          {boost && <span className="text-muted text-footnote font-normal">{boost}</span>}
        </span>
        <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
      </button>

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
