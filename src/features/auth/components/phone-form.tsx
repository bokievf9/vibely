'use client'

import { useActionState } from 'react'
import { Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useErrorText, useI18n } from '@/i18n/client'
import { sendOtp, type AuthFormState } from '../actions'
import { PHONE_PLACEHOLDER } from '../constants'

export function PhoneForm() {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [state, action, pending] = useActionState<AuthFormState, FormData>(sendOtp, null)
  const error = errorText(state && !state.ok ? state.error : undefined)

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
      <FormError message={error} />
      <Button type="submit" loading={pending} fullWidth>
        {dict.auth.getCode}
      </Button>
    </form>
  )
}
