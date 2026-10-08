'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { track } from '@/lib/analytics'
import { turnstileSiteKey } from '@/lib/env.optional'
import { resendOtp, verifyOtp, type AuthFormState } from '../actions'
import { Turnstile, type TurnstileHandle } from './turnstile'

const RESEND_COOLDOWN_S = 60

export function OtpForm({ phone }: { phone: string }) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [state, action, pending] = useActionState<AuthFormState, FormData>(verifyOtp, null)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S)
  const [resendError, setResendError] = useState<ErrorKey>()
  const [resending, startResend] = useTransition()
  const [captchaToken, setCaptchaToken] = useState('')
  const captcha = useRef<TurnstileHandle>(null)

  // Reaching this screen means the SMS went out.
  useEffect(() => track('signup_otp_sent'), [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const resend = () =>
    startResend(async () => {
      const result = await resendOtp(captchaToken || undefined)
      captcha.current?.reset()
      setResendError(result.ok ? undefined : result.error)
      if (result.ok) setCooldown(RESEND_COOLDOWN_S)
    })

  const error = errorText(state && !state.ok ? state.error : resendError)

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Field label={fmt(dict.auth.otpLabel, { phone })} htmlFor="token">
        <Input
          id="token"
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="••••••"
          required
          autoFocus
          aria-invalid={Boolean(error) || undefined}
          aria-describedby="token-msg"
          className="text-center text-2xl tracking-[0.5em]"
        />
      </Field>
      <FormError message={error} />
      {turnstileSiteKey && (
        <Turnstile
          ref={captcha}
          siteKey={turnstileSiteKey}
          action="resend_otp"
          onToken={setCaptchaToken}
        />
      )}
      <Button type="submit" loading={pending} fullWidth>
        {dict.auth.confirm}
      </Button>
      <Button variant="ghost" onClick={resend} loading={resending} disabled={cooldown > 0}>
        {cooldown > 0 ? fmt(dict.auth.resendIn, { s: cooldown }) : dict.auth.resend}
      </Button>
    </form>
  )
}
