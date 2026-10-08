'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { getIcebreakerFacts } from '../actions'
import { buildIcebreakers, type IcebreakerFacts } from '../build'

type Props = { matchId: string; onPick: (text: string) => void; className?: string }

// Three tap-to-use first messages. Renders nothing until the facts arrive (or if they fail).
export function IcebreakerList({ matchId, onPick, className }: Props) {
  const { dict } = useI18n()
  const [facts, setFacts] = useState<IcebreakerFacts | null>(null)

  useEffect(() => {
    let active = true
    void getIcebreakerFacts(matchId).then((r) => active && r.ok && setFacts(r.data))
    return () => {
      active = false
    }
  }, [matchId])

  const lines = useMemo(
    () =>
      facts
        ? buildIcebreakers(facts, {
            t: dict.discover.icebreakers,
            tagLabel: (slug) => dict.tags[slug] ?? slug,
            question: (key) => dict.about.prompts.keys[key],
          })
        : [],
    [facts, dict],
  )
  if (!lines.length) return null

  return (
    <section className={cn('flex w-full flex-col gap-2 text-left', className)}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="text-accent size-4" aria-hidden /> {dict.discover.icebreakers.title}
      </h3>
      <p className="text-muted text-xs">{dict.discover.icebreakers.hint}</p>
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line}>
            <button
              type="button"
              onClick={() => onPick(line)}
              className="border-border bg-surface active:bg-border w-full rounded-2xl border px-4 py-2.5 text-left text-sm [overflow-wrap:anywhere] transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.98]"
            >
              {line}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
