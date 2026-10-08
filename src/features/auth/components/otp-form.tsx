'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { fmt } from '@/i18n/config'
import { LocaleLink, useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { track } from '@/lib/analytics'
import { turnstileSiteKey } from '@/lib/env.optional'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { resendOtp, verifyOtp, type AuthFormState } from '../actions'
import { Turnstile, type TurnstileHandle } from './turnstile'

const RESEND_COOLDOWN_S = 60
const LENGTH = 6

// Pasted SMS text ("Your Vibely code is 123 456") or autofill: take a standalone 6-digit group if
// there is one, otherwise the first six digits typed.
function toCode(raw: string) {
  const group = raw.match(/(?:^|\D)(\d{3}\s?\d{3})(?:\D|$)/)?.[1]
  return (group ?? raw).replace(/\D/g, '').slice(0, LENGTH)
}

// Six boxes drawn over one real input: autofill (autocomplete="one-time-code"), paste and the
// screen reader all see a single field. The code submits itself when the sixth digit lands.
export function OtpForm({ phone }: { phone: string }) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [state, action, pending] = useActionState<AuthFormState, FormData>(verifyOtp, null)
  const [, startSubmit] = useTransition()
  const [code, setCode] = useState('')
  const [focused, setFocused] = useState(true)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S)
  const [resendError, setResendError] = useState<ErrorKey>()
  const [resending, startResend] = useTransition()
  const [captchaToken, setCaptchaToken] = useState('')
  const captcha = useRef<TurnstileHandle>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reaching this screen means the SMS went out.
  useEffect(() => track('signup_otp_sent'), [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // A wrong code empties the boxes for the next try (adjusting state during render, not in an effect).
  const [seenState, setSeenState] = useState(state)
  if (state !== seenState) {
    setSeenState(state)
    if (state && !state.ok) setCode('')
  }
  useEffect(() => {
    if (!state || state.ok) return
    haptic('warning')
    inputRef.current?.focus()
  }, [state])

  const submit = (value: string) => {
    if (value.length !== LENGTH || pending) return
    const data = new FormData()
    data.set('token', value)
    startSubmit(() => action(data))
  }

  const change = (raw: string) => {
    const next = toCode(raw)
    setCode(next)
    if (next.length === LENGTH && next !== code) submit(next)
  }

  const resend = () =>
    startResend(async () => {
      const result = await resendOtp(captchaToken || undefined)
      captcha.current?.reset()
      setResendError(result.ok ? undefined : result.error)
      if (result.ok) setCooldown(RESEND_COOLDOWN_S)
    })

  const error = errorText(state && !state.ok ? state.error : resendError)
  const invalid = Boolean(state && !state.ok) && code.length === 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(code)
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="token" className="text-muted min-w-0 text-sm font-medium">
            {fmt(dict.auth.otpLabel, { phone })}
          </label>
          <LocaleLink
            href="/login"
            replace
            className="text-accent -mr-2 flex h-11 shrink-0 items-center rounded-2xl px-2 text-sm font-medium active:opacity-60"
          >
            {dict.flows.otp.changeNumber}
          </LocaleLink>
        </div>
        <div className="relative">
          <div className="grid grid-cols-6 gap-2" aria-hidden>
            {Array.from({ length: LENGTH }, (_, i) => {
              const active = focused && !pending && i === Math.min(code.length, LENGTH - 1)
              return (
                <span
                  key={i}
                  className={cn(
                    'bg-surface flex h-14 items-center justify-center rounded-2xl border text-2xl font-semibold tabular-nums transition-colors duration-150',
                    invalid
                      ? 'border-danger/70'
                      : active
                        ? 'border-accent'
                        : code[i]
                          ? 'border-foreground/25'
                          : 'border-border',
                  )}
                >
                  {code[i] ??
                    (active && <span className="bg-accent h-6 w-0.5 animate-pulse rounded-full" />)}
                </span>
              )
            })}
          </div>
          {/* The real field covers the boxes so a tap or a long-press (Paste) lands on it. */}
          <input
            ref={inputRef}
            id="token"
            name="token"
            value={code}
            onChange={(e) => change(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            inputMode="numeric"
            autoComplete="one-time-code"
            enterKeyHint="done"
            pattern="\d{6}"
            required
            autoFocus
            // readOnly, not disabled: a disabled field drops focus and the keyboard with it, and
            // iOS will not reopen it from code after a wrong code.
            readOnly={pending}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby="token-msg"
            className="absolute inset-0 size-full bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
          />
        </div>
      </div>
      <div id="token-msg">
        <FormError message={error} />
      </div>
      {/* The phone step already passed a captcha; this one only guards "Resend", so it mounts
          when resend becomes available instead of greeting the user with a second check. */}
      {turnstileSiteKey && cooldown <= 0 && (
        <Turnstile
          ref={captcha}
          siteKey={turnstileSiteKey}
          action="resend_otp"
          onToken={setCaptchaToken}
        />
      )}
      <Button type="submit" loading={pending} disabled={code.length !== LENGTH} fullWidth>
        {dict.auth.confirm}
      </Button>
      <Button variant="ghost" onClick={resend} loading={resending} disabled={cooldown > 0}>
        <span className="tabular-nums">
          {cooldown > 0 ? fmt(dict.auth.resendIn, { s: cooldown }) : dict.auth.resend}
        </span>
      </Button>
    </form>
  )
}
