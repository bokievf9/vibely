'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { useErrorText, useI18n } from '@/i18n/client'
import { submitAppeal } from '../actions'

// Appeal against a ban (/banned). One open appeal at a time; the page shows its status instead.
export function AppealForm() {
  const { dict } = useI18n()
  const t = dict.sanctions
  const errorText = useErrorText()
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  if (sent) return <p className="text-muted text-sm">{t.appealSent}</p>

  const send = () =>
    startTransition(async () => {
      setError(undefined)
      const result = await submitAppeal(text)
      if (result.ok) setSent(true)
      else setError(errorText(result.error))
    })

  return (
    <section className="flex w-full flex-col gap-3 text-left">
      <h2 className="text-lg font-semibold">{t.appealTitle}</h2>
      <p className="text-muted text-sm">{t.appealHint}</p>
      <Field label={t.appealLabel} htmlFor="appeal" error={error}>
        <Textarea
          id="appeal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder={t.appealPlaceholder}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? 'appeal-msg' : undefined}
        />
      </Field>
      <Button onClick={send} loading={pending} disabled={text.trim().length < 10} fullWidth>
        {t.appealSend}
      </Button>
    </section>
  )
}
