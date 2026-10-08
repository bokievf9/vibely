'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { useErrorText } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import type { UserResult } from '@/i18n/errors'
import { IdentityToggle } from './identity-toggle'

type Props = {
  placeholder: string
  submitLabel: string
  maxLength: number
  hint?: string
  onSubmit: (body: string, asMe: boolean) => Promise<UserResult<string>>
  onDone: () => void
}

// Text box shared by new posts and comments, with the "Anonymous / As me" choice.
export function Composer({ placeholder, submitLabel, maxLength, hint, onSubmit, onDone }: Props) {
  const errorText = useErrorText()
  const [body, setBody] = useState('')
  const [asMe, setAsMe] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const submit = () =>
    startTransition(async () => {
      const result = await onSubmit(body, asMe)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setBody('')
      onDone()
    })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex flex-col gap-2"
    >
      <IdentityToggle asMe={asMe} onChange={setAsMe} />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-20"
      />
      {hint && <p className="text-muted text-xs">{hint}</p>}
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted text-xs tabular-nums">
          {body.length}/{maxLength}
        </span>
        <Button type="submit" size="sm" loading={pending} disabled={!body.trim()}>
          {submitLabel}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {errorText(error)}
        </p>
      )}
    </form>
  )
}
