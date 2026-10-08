'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useErrorText, useI18n } from '@/i18n/client'
import { turnstileSiteKey } from '@/lib/env.optional'
import { sendOtp, type AuthFormState } from '../actions'
import { PHONE_PLACEHOLDER } from '../constants'
import { Turnstile, type TurnstileHandle } from './turnstile'

export function PhoneForm() {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [state, action, pending] = useActionState<AuthFormState, FormData>(sendOtp, null)
  const error = errorText(state && !state.ok ? state.error : undefined)
  const [captchaToken, setCaptchaToken] = useState('')
  const captcha = useRef<TurnstileHandle>(null)

  // A failed attempt has used up the token: ask Turnstile for a new one.
  useEffect(() => {
    if (state && !state.ok) captcha.current?.reset()
  }, [state])

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Field label={dict.auth.phoneLabel} htmlFor="phone" hint={dict.auth.phoneHint}>
        <div className="relative">
          <Phone className="text-muted pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={PHONE_PLACEHOLDER}
            required
            autoFocus
            aria-invalid={Boolean(error) || undefined}
            aria-describedby="phone-msg"
            className="pl-12"
          />
        </div>
      </Field>
      {turnstileSiteKey && (
        <>
          <Turnstile
            ref={captcha}
            siteKey={turnstileSiteKey}
            action="send_otp"
            onToken={setCaptchaToken}
          />
          <input type="hidden" name="captchaToken" value={captchaToken} />
        </>
      )}
      <FormError message={error} />
      <Button type="submit" loading={pending} fullWidth>
        {dict.auth.getCode}
      </Button>
    </form>
  )
}
