'use client'

import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import {
  MAX_PROMPTS,
  PROMPT_KEYS,
  PROMPT_MAX_LENGTH,
  type ProfilePrompt,
  type PromptKey,
} from '../about-schemas'

type Props = {
  value: ProfilePrompt[] | undefined
  onChange: (value: ProfilePrompt[]) => void
  errorFor: (index: number) => string | undefined
}

const isPromptKey = (v: string): v is PromptKey => PROMPT_KEYS.some((k) => k === v)

// Up to three prompts: pick a question (each once), write a short answer.
export function PromptsEditor({ value = [], onChange, errorFor }: Props) {
  const { dict } = useI18n()
  const t = dict.about.prompts
  const used = new Set(value.map((p) => p.key))
  const unused = PROMPT_KEYS.filter((k) => !used.has(k))

  const update = (i: number, patch: Partial<ProfilePrompt>) =>
    onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const add = () => unused[0] && onChange([...value, { key: unused[0], answer: '' }])
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-sm">{fmt(t.hint, { max: MAX_PROMPTS })}</p>
      {value.map((prompt, i) => {
        const error = errorFor(i)
        return (
          <div
            key={prompt.key}
            className="bg-surface border-border flex flex-col gap-2 rounded-2xl border p-3"
          >
            <div className="flex items-center gap-2">
              <select
                aria-label={t.question}
                className="bg-background border-border min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm font-semibold"
                value={prompt.key}
                onChange={(e) => isPromptKey(e.target.value) && update(i, { key: e.target.value })}
              >
                {PROMPT_KEYS.filter((k) => k === prompt.key || !used.has(k)).map((k) => (
                  <option key={k} value={k}>
                    {t.keys[k]}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t.remove}
                onClick={() => remove(i)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <Textarea
              aria-label={t.answer}
              aria-invalid={Boolean(error) || undefined}
              placeholder={t.answer}
              maxLength={PROMPT_MAX_LENGTH}
              className="min-h-20"
              value={prompt.answer}
              onChange={(e) => update(i, { answer: e.target.value })}
            />
            <div className="flex justify-between gap-2 text-xs">
              <span role={error ? 'alert' : undefined} className="text-danger">
                {error}
              </span>
              <span className="text-muted">
                {prompt.answer.length}/{PROMPT_MAX_LENGTH}
              </span>
            </div>
          </div>
        )
      })}
      {value.length < MAX_PROMPTS && (
        <Button type="button" variant="secondary" onClick={add}>
          <Plus className="size-5" /> {t.add}
        </Button>
      )}
    </div>
  )
}
