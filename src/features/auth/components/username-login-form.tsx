'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { AtSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useErrorText, useI18n } from '@/i18n/client'
import { turnstileSiteKey } from '@/lib/env.optional'
import { haptic } from '@/lib/haptics'
import { signInWithUsername, type AuthFormState } from '../actions'
import { PasswordInput } from './password-input'
import { Turnstile, type TurnstileHandle } from './turnstile'

// Login → "Username" tab: @username + password. Every failure reads the same, whether the
// username exists, has no password or the password is wrong.
export function UsernameLoginForm({ onUsePhone }: { onUsePhone: () => void }) {
  const { dict } = useI18n()
  const t = dict.password
  const errorText = useErrorText()
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signInWithUsername, null)
  const error = errorText(state && !state.ok ? state.error : undefined)
  const [captchaToken, setCaptchaToken] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)
  // Controlled, so React's reset after the action keeps the username; the password is cleared.
  const [username, setUsername] = useState('')
  const captcha = useRef<TurnstileHandle>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  // A failed attempt has used up the captcha token.
  useEffect(() => {
    if (!state || state.ok) return
    captcha.current?.reset()
    haptic('warning')
    passwordRef.current?.focus()
  }, [state])

  return (
    <>
      <form action={action} className="flex flex-col gap-5" noValidate>
        <Field label={t.usernameLabel} htmlFor="login-username">
          <div className="relative">
            <AtSign className="text-muted pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
            <Input
              id="login-username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              maxLength={40}
              placeholder={t.usernamePlaceholder.replace(/^@/, '')}
              required
              autoFocus
              aria-invalid={Boolean(error) || undefined}
              className="pl-12"
            />
          </div>
        </Field>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="login-password" className="text-muted text-sm font-medium">
              {t.passwordLabel}
            </label>
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="text-accent -mr-2 flex h-11 shrink-0 items-center rounded-2xl px-2 text-sm font-medium active:opacity-60"
            >
              {t.forgot}
            </button>
          </div>
          <PasswordInput
            ref={passwordRef}
            id="login-password"
            name="password"
            autoComplete="current-password"
            enterKeyHint="go"
            maxLength={256}
            required
            aria-invalid={Boolean(error) || undefined}
          />
        </div>
        {turnstileSiteKey && (
          <>
            <Turnstile
              ref={captcha}
              siteKey={turnstileSiteKey}
              action="password_login"
              onToken={setCaptchaToken}
            />
            <input type="hidden" name="captchaToken" value={captchaToken} />
          </>
        )}
        <FormError message={error} />
        <Button type="submit" loading={pending} fullWidth>
          {t.signIn}
        </Button>
        <p className="text-muted text-center text-sm">{t.usernameNote}</p>
      </form>

      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title={t.forgotTitle}>
        <div className="flex flex-col gap-5">
          <p className="text-muted">{t.forgotBody}</p>
          <Button
            fullWidth
            onClick={() => {
              setForgotOpen(false)
              onUsePhone()
            }}
          >
            {t.forgotAction}
          </Button>
        </div>
      </Modal>
    </>
  )
}
