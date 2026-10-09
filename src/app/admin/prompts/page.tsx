import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { PromptQueue } from '@/features/admin/components/prompt-queue'
import { getPromptQueue } from '@/features/admin/queries/prompts'

export const metadata: Metadata = { title: 'Вопрос дня' }

export default function PromptsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Вопрос дня</h1>
      <p className="text-muted text-sm">
        Новый вопрос каждый день в 19:00 по Малайзии (pg_cron), пуш уходит из приложения
        (.github/workflows/daily-prompt.yml). Ответы хранятся 90 дней.
      </p>
      <Suspense fallback={<PageSpinner />}>
        <Queue />
      </Suspense>
    </>
  )
}

async function Queue() {
  const queue = await getPromptQueue()
  if (!queue.available) {
    return (
      <p className="text-muted">
        Таблица вопросов ещё не создана: примените миграцию 20261009000220_feed_conversations.
      </p>
    )
  }
  return <PromptQueue queue={queue} />
}
