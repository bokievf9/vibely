'use client'

import Link from 'next/link'
import { useId, useRef, useState, useTransition, type FormEvent } from 'react'
import { ChevronDown, CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { Turnstile, type TurnstileHandle } from '@/features/auth/components/turnstile'
import { fmt, localePath, type Locale } from '@/i18n/config'
import type { LandingDictionary } from '@/i18n/dictionaries/landing/en'
import { track } from '@/lib/analytics'
import { turnstileSiteKey } from '@/lib/env.optional'
import { cn } from '@/lib/utils'
import { joinWaitlist } from '../actions'
import type { WaitlistError } from '../errors'
import { WAITLIST_CITIES, formatMalaysianMobile, normalizeMalaysianMobile } from '../phone'

type Props = {
  open: boolean
  onClose: () => void
  locale: Locale
  // Where the sheet was opened from (hero, final...), stored as waitlist.source.
  source: string
  submitLabel: string
  t: LandingDictionary['waitlist']
}

const PHONE_ERRORS: WaitlistError[] = ['phoneInvalid', 'phoneNotMalaysia', 'phoneNotMobile']

const fieldClass =
  'bg-surface-raised border-border w-full rounded-2xl border text-base outline-none shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] transition-[border-color,box-shadow] duration-150 ease-out focus:border-accent/70 focus:ring-accent/15 focus:ring-4 aria-invalid:border-danger aria-invalid:focus:ring-danger/20'

// Early access form in a bottom sheet (centered dialog on wide screens). Checks the obvious on
// the client, the server action and the database check again.
export function WaitlistSheet({ open, onClose, locale, source, submitLabel, t }: Props) {
  const [done, setDone] = useState<string | null>(null)
  return (
    <Modal
      open={open}
      onClose={() => {
        onClose()
        setDone(null)
      }}
      title={t.title}
    >
      {done ? (
        <div className="flex flex-col items-start gap-3 pb-2" role="status">
          <CircleCheck className="text-success size-10" aria-hidden />
          <p className="text-title2">{t.successTitle}</p>
          <p className="text-muted text-body">{fmt(t.successText, { phone: done })}</p>
          <Button
            variant="secondary"
            fullWidth
            className="mt-3"
            onClick={() => {
              onClose()
              setDone(null)
            }}
          >
            {t.done}
          </Button>
        </div>
      ) : (
        <WaitlistForm
          locale={locale}
          source={source}
          submitLabel={submitLabel}
          t={t}
          onDone={(phone) => setDone(phone)}
        />
      )}
    </Modal>
  )
}

function WaitlistForm({
  locale,
  source,
  submitLabel,
  t,
  onDone,
}: Omit<Props, 'open' | 'onClose'> & { onDone: (phone: string) => void }) {
  const id = useId()
  const phoneId = `${id}-phone`
  const cityId = `${id}-city`
  const consentId = `${id}-consent`
  const [error, setError] = useState<WaitlistError | null>(null)
  const [pending, startTransition] = useTransition()
  const [captchaToken, setCaptchaToken] = useState('')
  const captcha = useRef<TurnstileHandle>(null)
  const phoneRef = useRef<HTMLInputElement>(null)

  const phoneError = error && PHONE_ERRORS.includes(error) ? t.errors[error] : undefined
  const consentError = error === 'consentRequired' ? t.errors.consentRequired : undefined
  const cityError = error === 'cityInvalid' ? t.errors.cityInvalid : undefined
  const formError = error && !phoneError && !consentError && !cityError ? t.errors[error] : undefined

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const phone = String(form.get('phone') ?? '')
    const digits = normalizeMalaysianMobile(phone)
    if (!digits) {
      setError('phoneInvalid')
      phoneRef.current?.focus()
      return
    }
    if (form.get('consent') !== 'on') {
      setError('consentRequired')
      return
    }
    setError(null)
    track('waitlist_submit', { source })
    startTransition(async () => {
      const result = await joinWaitlist(form)
      if (result.ok) {
        track('waitlist_success', { source })
        onDone(formatMalaysianMobile(digits))
        return
      }
      setError(result.error)
      // Turnstile tokens are single use.
      captcha.current?.reset()
      if (PHONE_ERRORS.includes(result.error)) phoneRef.current?.focus()
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 pb-1">
      <p className="text-muted text-callout -mt-1">{t.text}</p>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="source" value={source} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={phoneId} className="text-muted text-footnote px-1 font-medium">
          {t.phoneLabel}
        </label>
        <div className="relative">
          <span
            aria-hidden
            className="text-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base font-semibold"
          >
            +60
          </span>
          <input
            ref={phoneRef}
            id={phoneId}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            enterKeyHint="done"
            placeholder={t.phonePlaceholder}
            maxLength={20}
            required
            aria-invalid={Boolean(phoneError) || undefined}
            aria-describedby={`${phoneId}-msg`}
            onChange={() => phoneError && setError(null)}
            className={cn(fieldClass, 'placeholder:text-muted h-[3.25rem] pr-4 pl-14')}
          />
        </div>
        <p
          id={`${phoneId}-msg`}
          role={phoneError ? 'alert' : undefined}
          className={cn('px-1 text-sm', phoneError ? 'text-danger' : 'text-muted')}
        >
          {phoneError ?? t.phoneHint}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={cityId} className="text-muted text-footnote px-1 font-medium">
          {t.cityLabel}
        </label>
        <div className="relative">
          <select
            id={cityId}
            name="city"
            defaultValue=""
            aria-invalid={Boolean(cityError) || undefined}
            aria-describedby={cityError ? `${cityId}-msg` : undefined}
            className={cn(fieldClass, 'h-[3.25rem] appearance-none pr-11 pl-4')}
          >
            <option value="">{t.cityPlaceholder}</option>
            {WAITLIST_CITIES.map((c) => (
              <option key={c} value={c}>
                {t.cities[c]}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="text-muted pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2"
          />
        </div>
        {cityError && (
          <p id={`${cityId}-msg`} role="alert" className="text-danger px-1 text-sm">
            {cityError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          {/* 44px tap target around a 22px box. */}
          <span className="-m-[11px] flex shrink-0 p-[11px]">
            <input
              id={consentId}
              name="consent"
              type="checkbox"
              required
              aria-invalid={Boolean(consentError) || undefined}
              aria-describedby={consentError ? `${consentId}-msg` : undefined}
              onChange={() => consentError && setError(null)}
              className="accent-accent size-[22px] cursor-pointer"
            />
          </span>
          <label htmlFor={consentId} className="text-callout text-foreground/90 cursor-pointer">
            {t.consentBefore}
            <Link
              href={`${localePath(locale, '/privacy')}#waitlist`}
              target="_blank"
              rel="noopener"
              className="text-accent font-medium underline underline-offset-2"
            >
              {t.consentLink}
            </Link>
            {t.consentAfter}
          </label>
        </div>
        {consentError && (
          <p id={`${consentId}-msg`} role="alert" className="text-danger px-1 text-sm">
            {consentError}
          </p>
        )}
      </div>

      {turnstileSiteKey && (
        <>
          <Turnstile
            ref={captcha}
            siteKey={turnstileSiteKey}
            action="waitlist"
            onToken={setCaptchaToken}
          />
          <input type="hidden" name="captchaToken" value={captchaToken} />
        </>
      )}

      <FormError message={formError} />
      <Button type="submit" loading={pending} fullWidth aria-label={pending ? t.sending : undefined}>
        {submitLabel}
      </Button>
    </form>
  )
}
