'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { addRiskKeyword, removeRiskKeyword } from '../flag-actions'
import type { RiskKeyword } from '../queries/flags'
import { useModeration } from './use-moderation'

const WEIGHTS = [1, 2, 3, 5, 8] as const

// Words and phrases that flag a message (whole words, any case). Weight = points per conversation.
export function KeywordEditor({ keywords }: { keywords: RiskKeyword[] }) {
  const { pending, error, run } = useModeration()
  const [keyword, setKeyword] = useState('')
  const [weight, setWeight] = useState<number>(3)

  const add = async () => {
    const ok = await run(() => addRiskKeyword({ keyword, weight }))
    if (ok) setKeyword('')
  }

  return (
    <section className="bg-surface flex flex-col gap-3 rounded-3xl p-4">
      <h2 className="font-semibold">Ключевые слова</h2>
      <p className="text-muted text-sm">
        Сообщение с таким словом или фразой (целиком, без учёта регистра) получает флаг. Вес:
        сколько очков добавляет один разговор. Телефон и мессенджер дают 3, ссылка 2, деньги 1;
        список пользователей ниже показывает тех, у кого 8 и больше за 14 дней.
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Например: hadiah percuma"
          aria-label="Ключевое слово"
          maxLength={60}
          className="min-w-48 flex-1"
        />
        <select
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          aria-label="Вес"
          className="bg-background border-border h-12 rounded-2xl border px-3"
        >
          {WEIGHTS.map((w) => (
            <option key={w} value={w}>
              Вес {w}
            </option>
          ))}
        </select>
        <Button type="submit" loading={pending} disabled={keyword.trim().length < 3}>
          <Plus className="size-4" /> Добавить
        </Button>
      </form>
      <FormError message={error} />
      {keywords.length ? (
        <ul className="flex flex-wrap gap-2">
          {keywords.map((k) => (
            <li
              key={k.id}
              className="bg-background flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm"
            >
              {k.keyword}
              <span className="text-muted text-xs">×{k.weight}</span>
              <button
                type="button"
                aria-label={`Удалить «${k.keyword}»`}
                disabled={pending}
                onClick={() => run(() => removeRiskKeyword({ id: k.id }))}
                className="active:bg-border rounded-full p-1"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">Список пуст</p>
      )}
    </section>
  )
}
