'use client'

import { useEffect, useState } from 'react'
import { AtSign, Check, CircleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { checkUsername } from '../actions'
import { USERNAME_MAX, isValidUsername, normalizeUsername, type UsernameStatus } from '../schemas'

const CHECK_DELAY_MS = 400

type Checked = { value: string; status: UsernameStatus | 'failed' }

type Props = {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  // Form validation or server error (already translated); replaces the live status.
  error?: string
  // Shown under the field while nothing more specific applies.
  hint?: string
  autoFocus?: boolean
  disabled?: boolean
}

// "@" input with a debounced availability check against the database.
export function UsernameField({
  id,
  value,
  onChange,
  onBlur,
  error,
  hint,
  autoFocus,
  disabled,
}: Props) {
  const { dict } = useI18n()
  const t = dict.username
  const normalized = normalizeUsername(value)
  const valid = isValidUsername(normalized)
  const [checked, setChecked] = useState<Checked | null>(null)

  useEffect(() => {
    if (!valid) return
    let alive = true
    const timer = setTimeout(() => {
      void checkUsername(normalized)
        .then((r) => alive && setChecked({ value: normalized, status: r.ok ? r.data : 'failed' }))
        .catch(() => alive && setChecked({ value: normalized, status: 'failed' }))
    }, CHECK_DELAY_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [normalized, valid])

  const status: UsernameStatus | 'failed' | 'checking' | 'empty' = !normalized
    ? 'empty'
    : !valid
      ? 'invalid'
      : checked?.value === normalized
        ? checked.status
        : 'checking'

  const message: { text: string; tone: 'ok' | 'bad' | 'muted' } | null = error
    ? { text: error, tone: 'bad' }
    : status === 'ok'
      ? { text: fmt(t.available, { username: normalized }), tone: 'ok' }
      : status === 'current'
        ? { text: t.current, tone: 'muted' }
        : status === 'taken'
          ? { text: fmt(t.taken, { username: normalized }), tone: 'bad' }
          : status === 'reserved'
            ? { text: t.reserved, tone: 'bad' }
            : status === 'invalid'
              ? { text: t.invalid, tone: 'bad' }
              : status === 'failed'
                ? { text: t.checkFailed, tone: 'muted' }
                : status === 'checking'
                  ? { text: t.checking, tone: 'muted' }
                  : hint
                    ? { text: hint, tone: 'muted' }
                    : null
  const bad = message?.tone === 'bad'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <AtSign
          className="text-muted pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
          aria-hidden
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, '').toLowerCase())}
          onBlur={onBlur}
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          maxLength={USERNAME_MAX + 1}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={bad || undefined}
          aria-describedby={`${id}-msg`}
          className="pr-11 pl-11"
        />
        <span className="absolute top-1/2 right-4 -translate-y-1/2" aria-hidden>
          {status === 'checking' ? (
            <Spinner className="size-4" />
          ) : status === 'ok' ? (
            <Check className="size-5 text-emerald-400" />
          ) : bad ? (
            <CircleAlert className="size-5 text-red-400" />
          ) : null}
        </span>
      </div>
      <p
        id={`${id}-msg`}
        aria-live="polite"
        role={error ? 'alert' : undefined}
        className={cn(
          'min-h-5 text-sm',
          message?.tone === 'bad'
            ? 'text-red-400'
            : message?.tone === 'ok'
              ? 'text-emerald-400'
              : 'text-muted',
        )}
      >
        {message?.text}
      </p>
    </div>
  )
}
