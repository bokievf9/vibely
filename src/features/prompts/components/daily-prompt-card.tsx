'use client'

import { useState, useTransition } from 'react'
import { Check, Lightbulb } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { startPromptConversation } from '@/features/blind-date/actions'
import { answerDailyPrompt } from '../actions'
import { percentages, totalAnswers } from '../share'
import type { DailyPrompt, PromptMatch } from '../types'

type Props = { prompt: DailyPrompt; matches: PromptMatch[] }

// Question of the day at the top of the feed: pick an answer, then see how everyone voted and up
// to 8 people near you who picked the same (name, age, photo: the same as a Discover card).
// "Say hi" opens a conversation with names shown from the start.
export function DailyPromptCard({ prompt: initial, matches: initialMatches }: Props) {
  const { dict, locale } = useI18n()
  const c = dict.conversations
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [prompt, setPrompt] = useState(initial)
  const [matches, setMatches] = useState(initialMatches)
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const [picked, setPicked] = useState<number | null>(null)
  const [starting, setStarting] = useState<string | null>(null)

  const options = prompt.options[locale]
  const answered = prompt.myOption !== null && prompt.counts !== null && !changing
  const counts = prompt.counts ?? []
  const pct = percentages(counts)
  const total = totalAnswers(counts)

  const answer = (idx: number) => {
    if (pending) return
    setPicked(idx)
    setError(undefined)
    startTransition(async () => {
      const result = await answerDailyPrompt(prompt.id, idx)
      setPicked(null)
      if (!result.ok) return setError(result.error)
      setPrompt(result.data.prompt)
      setMatches(result.data.matches)
      setChanging(false)
    })
  }

  const sayHi = (target: string) => {
    if (starting) return
    setStarting(target)
    setError(undefined)
    startTransition(async () => {
      const result = await startPromptConversation(prompt.id, target)
      setStarting(null)
      if (!result.ok) return setError(result.error)
      router.push(`/blind-date/${result.data.sessionId}`)
    })
  }

  return (
    <section className="card flex flex-col gap-3 px-4 py-4" aria-labelledby="daily-prompt">
      <header className="flex flex-col gap-1">
        <span className="text-accent text-caption flex items-center gap-1.5 font-semibold tracking-wide uppercase">
          <Lightbulb className="size-3.5" aria-hidden /> {c.promptTitle}
        </span>
        <h2 id="daily-prompt" className="text-headline text-pretty">
          {prompt.question[locale]}
        </h2>
      </header>

      {answered ? (
        <ol className="flex flex-col gap-2" aria-label={c.promptTitle}>
          {options.map((label, i) => {
            const mine = i === prompt.myOption
            return (
              <li
                key={i}
                className={cn(
                  'relative overflow-hidden rounded-2xl border px-3.5 py-2.5',
                  mine ? 'border-accent/50' : 'border-border',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-2xl transition-[width] duration-500 ease-out',
                    mine ? 'bg-accent/20' : 'bg-fill',
                  )}
                  style={{ width: `${pct[i] ?? 0}%` }}
                />
                <span className="relative flex items-center justify-between gap-3 text-[15px]">
                  <span
                    className={cn('flex min-w-0 items-center gap-1.5', mine && 'font-semibold')}
                  >
                    {mine && <Check className="text-accent size-4 shrink-0" aria-hidden />}
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{pct[i] ?? 0}%</span>
                </span>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="flex flex-col gap-2" role="group" aria-label={c.promptTitle}>
          {options.map((label, i) => (
            <Button
              key={i}
              variant="secondary"
              className="h-12 justify-start px-4 text-[15px]"
              loading={pending && picked === i}
              disabled={pending}
              onClick={() => answer(i)}
            >
              {label}
            </Button>
          ))}
          <p className="text-muted text-footnote px-1">{c.promptAnswerHint}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-danger text-footnote">
          {errorText(error)}
        </p>
      )}

      {answered && (
        <>
          <div className="text-muted text-footnote flex items-center justify-between gap-2">
            <span>{fmt(c.promptAnswered, { count: total })}</span>
            <button
              type="button"
              className="text-accent -my-2 min-h-11 px-1 font-medium"
              onClick={() => setChanging(true)}
            >
              {c.promptChange}
            </button>
          </div>
          <div className="border-border flex flex-col gap-2 border-t pt-3">
            <h3 className="text-callout font-semibold">{c.promptSame}</h3>
            {matches.length === 0 ? (
              <p className="text-muted text-footnote">{c.promptNobody}</p>
            ) : (
              <>
                <p className="text-muted text-footnote">{c.promptSameHint}</p>
                <ul className="-mx-4 flex snap-x scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
                  {matches.map((m) => (
                    <li
                      key={m.id}
                      className="bg-surface-raised border-border flex w-[7.25rem] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl border p-3"
                    >
                      <Avatar photo={m.photo} alt="" size={64} />
                      <span className="w-full truncate text-center text-[13px] font-semibold">
                        {m.name}, {m.age}
                      </span>
                      <Button
                        size="sm"
                        className="h-9 w-full"
                        loading={starting === m.id}
                        disabled={starting !== null}
                        onClick={() => sayHi(m.id)}
                      >
                        {c.sayHi}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
      <p className="text-muted text-caption">{c.promptNewAt}</p>
    </section>
  )
}
