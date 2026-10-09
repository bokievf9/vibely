'use client'

import { useRef, useState, useTransition } from 'react'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { turnstileSiteKey } from '@/lib/env.optional'
import { resetBrowserToken } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  beginPasswordChange,
  removePassword,
  savePassword,
  sendPasswordCode,
  verifyPasswordCode,
} from '../password-actions'
import { PASSWORD_MIN, passwordError, passwordScore } from '../password'
import { PasswordInput } from './password-input'
import { Turnstile, type TurnstileHandle } from './turnstile'

type Step = 'send' | 'code' | 'password'

const METER = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success'] as const

// Settings → Sign-in password: set, change (after a fresh SMS code) or remove.
export function PasswordSettingsRows({
  initial,
  username,
}: {
  initial: boolean
  username: string
}) {
  const { dict } = useI18n()
  const t = dict.password
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [hasPassword, setHasPassword] = useState(initial)
  const [notice, setNotice] = useState<string>()
  const [rowError, setRowError] = useState<ErrorKey>()
  const [opening, startOpening] = useTransition()

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('send')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<ErrorKey>()
  const [busy, startBusy] = useTransition()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const captcha = useRef<TurnstileHandle>(null)

  const [removeOpen, setRemoveOpen] = useState(false)

  const begin = () =>
    startOpening(async () => {
      setNotice(undefined)
      setRowError(undefined)
      const result = await beginPasswordChange()
      if (!result.ok) return setRowError(result.error)
      setPhone(result.data.phone)
      setStep(result.data.needsCode ? 'send' : 'password')
      setCode('')
      setPassword('')
      setRepeat('')
      setError(undefined)
      setOpen(true)
    })

  const close = () => {
    if (busy) return
    setOpen(false)
    setPassword('')
    setRepeat('')
  }

  const sendCode = () =>
    startBusy(async () => {
      const result = await sendPasswordCode(captchaToken || undefined)
      captcha.current?.reset()
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setCode('')
      setStep('code')
    })

  const verify = (value: string) =>
    startBusy(async () => {
      const result = await verifyPasswordCode(value)
      if (!result.ok) {
        setCode('')
        return setError(result.error)
      }
      // The SMS sign-in replaced the session: the browser must borrow the new token.
      resetBrowserToken()
      setError(undefined)
      setStep('password')
    })

  const save = () =>
    startBusy(async () => {
      const result = await savePassword({ password, repeat })
      if (!result.ok) {
        if (result.error === 'passwordReauth') setStep('send')
        return setError(result.error)
      }
      setHasPassword(true)
      setNotice(t.saved)
      setOpen(false)
      setPassword('')
      setRepeat('')
      router.refresh()
    })

  const remove = () =>
    startBusy(async () => {
      const result = await removePassword()
      if (!result.ok) return setError(result.error)
      setHasPassword(false)
      setNotice(t.removed)
      setRemoveOpen(false)
      router.refresh()
    })

  const score = passwordScore(password)
  const rule = password ? passwordError(password, { username, phone: null }) : null
  const mismatch = repeat.length > 0 && repeat !== password
  const canSave = password.length >= PASSWORD_MIN && !rule && repeat === password

  return (
    <>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <KeyRound className="size-5 shrink-0" aria-hidden />
            <span className="truncate">{hasPassword ? t.statusOn : t.statusOff}</span>
          </span>
          <Button variant="secondary" size="sm" loading={opening} onClick={begin}>
            {hasPassword ? t.change : t.set}
          </Button>
        </div>
        <p className="text-muted text-sm">
          {fmt(hasPassword ? t.hintOn : t.hintOff, { username })}
        </p>
        {(notice || rowError) && (
          <p
            role={rowError ? 'alert' : 'status'}
            className={cn('text-sm', rowError ? 'text-danger' : 'text-success')}
          >
            {rowError ? errorText(rowError) : notice}
          </p>
        )}
        {hasPassword && (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger self-start"
            onClick={() => {
              setError(undefined)
              setRemoveOpen(true)
            }}
          >
            {t.remove}
          </Button>
        )}
      </div>

      <Modal open={open} onClose={close} title={hasPassword ? t.changeTitle : t.setTitle}>
        {step === 'send' && (
          <div className="flex flex-col gap-5">
            <p className="text-muted">{fmt(t.verifyIntro, { phone })}</p>
            {turnstileSiteKey && (
              <Turnstile
                ref={captcha}
                siteKey={turnstileSiteKey}
                action="password_reauth"
                onToken={setCaptchaToken}
              />
            )}
            <FormError message={errorText(error)} />
            <Button fullWidth loading={busy} onClick={sendCode}>
              {t.sendCode}
            </Button>
          </div>
        )}

        {step === 'code' && (
          <form
            className="flex flex-col gap-5"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              if (code.length === 6 && !busy) verify(code)
            }}
          >
            <Field
              label={t.codeLabel}
              htmlFor="password-otp"
              hint={fmt(t.codeHint, { phone })}
              error={errorText(error)}
            >
              <Input
                id="password-otp"
                name="token"
                value={code}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setCode(next)
                  if (next.length === 6 && next !== code && !busy) verify(next)
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                enterKeyHint="done"
                pattern="\d{6}"
                autoFocus
                readOnly={busy}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby="password-otp-msg"
                className="text-center text-2xl font-semibold tracking-[0.4em] tabular-nums"
              />
            </Field>
            <Button type="submit" fullWidth loading={busy} disabled={code.length !== 6}>
              {t.verify}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setError(undefined)
                setStep('send')
              }}
            >
              {t.resend}
            </Button>
          </form>
        )}

        {step === 'password' && (
          <form
            className="flex flex-col gap-5"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              if (canSave && !busy) save()
            }}
          >
            {/* Lets the password manager store the new password under the right account. */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              readOnly
              hidden
            />
            <Field label={t.newLabel} htmlFor="new-password" hint={t.rules}>
              <PasswordInput
                id="new-password"
                name="new-password"
                autoComplete="new-password"
                enterKeyHint="next"
                maxLength={256}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(undefined)
                }}
                autoFocus
                aria-invalid={Boolean(password && rule) || undefined}
                aria-describedby="new-password-msg password-strength"
              />
            </Field>
            {password && (
              <div id="password-strength" className="flex flex-col gap-1.5" aria-live="polite">
                <div className="grid grid-cols-4 gap-1.5" aria-hidden>
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1.5 rounded-full transition-colors duration-200',
                        score >= i || (i === 1 && score === 0) ? METER[score] : 'bg-border',
                      )}
                    />
                  ))}
                </div>
                <p className={cn('text-sm', rule ? 'text-danger' : 'text-muted')}>
                  {rule && rule !== 'passwordWeak'
                    ? errorText(rule)
                    : fmt(t.strength, { level: t.levels[score] ?? '' })}
                </p>
              </div>
            )}
            <Field
              label={t.repeatLabel}
              htmlFor="repeat-password"
              error={mismatch ? errorText('passwordMismatch') : undefined}
            >
              <PasswordInput
                id="repeat-password"
                name="repeat-password"
                autoComplete="new-password"
                enterKeyHint="done"
                maxLength={256}
                value={repeat}
                onChange={(e) => {
                  setRepeat(e.target.value)
                  setError(undefined)
                }}
                aria-invalid={mismatch || undefined}
                aria-describedby="repeat-password-msg"
              />
            </Field>
            <FormError message={errorText(error)} />
            <Button type="submit" fullWidth loading={busy} disabled={!canSave}>
              {t.save}
            </Button>
          </form>
        )}
      </Modal>

      <Modal open={removeOpen} onClose={() => !busy && setRemoveOpen(false)} title={t.removeTitle}>
        <div className="flex flex-col gap-5">
          <p className="text-muted">{t.removeBody}</p>
          <FormError message={errorText(error)} />
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" disabled={busy} onClick={() => setRemoveOpen(false)}>
              {dict.common.cancel}
            </Button>
            <Button variant="danger" loading={busy} onClick={remove}>
              {t.removeConfirm}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
