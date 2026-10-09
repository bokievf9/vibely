'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deletePrompt, movePrompt } from '../prompt-actions'
import type { AdminPrompt, PromptQueue as Queue } from '../queries/prompts'
import { Badge, formatDate } from './badges'
import { PromptForm } from './prompt-form'
import { useModeration } from './use-moderation'

// Queue of upcoming questions (next on top, reorder with arrows, edit, delete) and the recent
// shown ones with their answer counts. Rotation happens in the database at 19:00 MYT.
export function PromptQueue({ queue }: { queue: Queue }) {
  const [editing, setEditing] = useState<AdminPrompt | null>(null)
  const { pending, error, run } = useModeration()

  return (
    <div className="flex flex-col gap-4">
      <PromptForm
        key={editing?.id ?? 'new'}
        editing={editing ?? undefined}
        onDone={() => setEditing(null)}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Очередь: {queue.queued.length}</h2>
        {queue.queued.length === 0 && (
          <p className="text-muted text-sm">Очередь пуста: завтра вопроса дня не будет.</p>
        )}
        <ol className="flex flex-col gap-2">
          {queue.queued.map((p, i) => (
            <li key={p.id} className="bg-surface flex flex-col gap-2 rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge className="bg-accent/15 text-accent">
                  {i === 0 ? 'Следующий' : `#${i + 1}`}
                </Badge>
                <span className="text-muted">добавлен {formatDate(p.createdAt)}</span>
              </div>
              <PromptText p={p} />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label="Выше"
                  disabled={pending || i === 0}
                  onClick={() => run(() => movePrompt({ id: p.id, up: true }))}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label="Ниже"
                  disabled={pending || i === queue.queued.length - 1}
                  onClick={() => run(() => movePrompt({ id: p.id, up: false }))}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setEditing(p)}
                >
                  <Pencil className="size-4" /> Изменить
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm('Удалить вопрос из очереди?'))
                      void run(() => deletePrompt({ id: p.id }))
                  }}
                >
                  <Trash2 className="size-4" /> Удалить
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Показанные (последние {queue.shown.length})</h2>
        {queue.shown.length === 0 && <p className="text-muted text-sm">Ещё ничего не показано.</p>}
        <ol className="flex flex-col gap-2">
          {queue.shown.map((p) => {
            const total = p.counts.reduce((a, b) => a + b, 0)
            return (
              <li key={p.id} className="bg-surface flex flex-col gap-2 rounded-2xl p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className="bg-emerald-500/15 text-emerald-400">{p.showDate}</Badge>
                  <span className="text-muted">
                    ответов: {total}
                    {p.pushedAt ? ' · пуш отправлен' : ' · пуш не отправлялся'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => setEditing(p)}
                  >
                    <Pencil className="size-4" /> Тексты
                  </Button>
                </div>
                <PromptText p={p} counts={p.counts} />
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}

function PromptText({ p, counts }: { p: AdminPrompt; counts?: number[] }) {
  const total = counts?.reduce((a, b) => a + b, 0) ?? 0
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-medium">{p.question.ru}</p>
      <p className="text-muted">
        {p.question.en} · {p.question.ms}
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {p.options.ru.map((o, i) => (
          <li key={i} className="text-muted">
            {o}{' '}
            <span className="text-foreground/70">
              / {p.options.en[i]} / {p.options.ms[i]}
            </span>
            {counts && (
              <span className="text-foreground ml-1 font-semibold tabular-nums">
                {counts[i] ?? 0}
                {total > 0 && ` (${Math.round(((counts[i] ?? 0) / total) * 100)}%)`}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
