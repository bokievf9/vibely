'use client'

import { useState } from 'react'
import { Lightbulb, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LOCALES, LOCALE_NAMES, type Locale } from '@/i18n/config'
import { savePrompt } from '../prompt-actions'
import type { AdminPrompt } from '../queries/prompts'
import { useAdminAction } from './use-admin-action'

type Draft = { question: Record<Locale, string>; options: Record<Locale, string[]> }

const empty = (): Draft => ({
  question: { en: '', ms: '', ru: '' },
  options: { en: ['', ''], ms: ['', ''], ru: ['', ''] },
})

const fromPrompt = (p: AdminPrompt): Draft => ({
  question: { ...p.question },
  options: { en: [...p.options.en], ms: [...p.options.ms], ru: [...p.options.ru] },
})

// Add or edit a question of the day: the three languages side by side, 2-4 options (the same
// count in every language), with a preview of the card as users see it.
export function PromptForm({ editing, onDone }: { editing?: AdminPrompt; onDone: () => void }) {
  const { pending, error, run } = useAdminAction()
  const [draft, setDraft] = useState<Draft>(editing ? fromPrompt(editing) : empty())
  const [preview, setPreview] = useState<Locale>('en')
  const count = draft.options.en.length

  const setQuestion = (l: Locale, v: string) =>
    setDraft((d) => ({ ...d, question: { ...d.question, [l]: v } }))
  const setOption = (l: Locale, i: number, v: string) =>
    setDraft((d) => ({
      ...d,
      options: { ...d.options, [l]: d.options[l].map((o, j) => (j === i ? v : o)) },
    }))
  const addOption = () =>
    setDraft((d) => ({
      ...d,
      options: Object.fromEntries(
        LOCALES.map((l) => [l, [...d.options[l], '']]),
      ) as Draft['options'],
    }))
  const removeOption = (i: number) =>
    setDraft((d) => ({
      ...d,
      options: Object.fromEntries(
        LOCALES.map((l) => [l, d.options[l].filter((_, j) => j !== i)]),
      ) as Draft['options'],
    }))

  const submit = async () => {
    const result = await run(() => savePrompt({ id: editing?.id, ...draft }))
    if (result.ok) {
      setDraft(empty())
      onDone()
    }
  }

  return (
    <form
      className="bg-surface flex flex-col gap-4 rounded-3xl p-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <h2 className="font-semibold">{editing ? 'Изменить вопрос' : 'Новый вопрос'}</h2>
      <p className="text-muted text-sm">
        Вопрос до 200 символов, варианты до 60, от 2 до 4 вариантов, одинаково на трёх языках. Без
        тире: только обычные знаки препинания.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {LOCALES.map((l) => (
          <fieldset key={l} className="flex flex-col gap-2">
            <legend className="text-muted mb-1 text-xs font-semibold uppercase">
              {LOCALE_NAMES[l]}
            </legend>
            <Input
              value={draft.question[l]}
              onChange={(e) => setQuestion(l, e.target.value)}
              placeholder="Вопрос"
              aria-label={`Вопрос (${l})`}
              maxLength={200}
            />
            {draft.options[l].map((o, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  value={o}
                  onChange={(e) => setOption(l, i, e.target.value)}
                  placeholder={`Вариант ${i + 1}`}
                  aria-label={`Вариант ${i + 1} (${l})`}
                  maxLength={60}
                />
                {l === 'en' && count > 2 && (
                  <button
                    type="button"
                    aria-label={`Удалить вариант ${i + 1}`}
                    className="active:bg-border text-muted shrink-0 rounded-full p-2"
                    onClick={() => removeOption(i)}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={count >= 4}
          onClick={addOption}
        >
          <Plus className="size-4" /> Вариант
        </Button>
        <span className="text-muted text-sm">{count} из 4</span>
      </div>

      <section
        className="bg-background flex flex-col gap-3 rounded-2xl p-4"
        aria-label="Предпросмотр"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-accent flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <Lightbulb className="size-3.5" aria-hidden /> Предпросмотр
          </span>
          <div className="flex gap-1">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={preview === l}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${preview === l ? 'bg-accent/15 text-accent' : 'text-muted'}`}
                onClick={() => setPreview(l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="font-semibold">{draft.question[preview] || '…'}</p>
        <div className="flex flex-col gap-2">
          {draft.options[preview].map((o, i) => (
            <span key={i} className="border-border rounded-2xl border px-4 py-2.5 text-[15px]">
              {o || '…'}
            </span>
          ))}
        </div>
      </section>

      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {editing ? 'Сохранить' : 'Добавить в очередь'}
        </Button>
        {editing && (
          <Button type="button" variant="secondary" onClick={onDone}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  )
}
