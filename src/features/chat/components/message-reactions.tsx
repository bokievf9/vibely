'use client'

import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { Reaction, ReactionEmoji } from '../types'

type Props = {
  reactions: Reaction[]
  viewerId: string
  onToggle: (emoji: ReactionEmoji) => void
}

// Reaction chips under a bubble. Tapping one sets (or removes) the same emoji as your own.
export function MessageReactions({ reactions, viewerId, onToggle }: Props) {
  const { dict } = useI18n()
  if (!reactions.length) return null
  const counts = new Map<ReactionEmoji, { count: number; mine: boolean }>()
  for (const r of reactions) {
    const c = counts.get(r.emoji) ?? { count: 0, mine: false }
    counts.set(r.emoji, { count: c.count + 1, mine: c.mine || r.userId === viewerId })
  }
  return (
    <ul className="-mt-1.5 flex flex-wrap gap-1 px-1" aria-label={dict.chats.reactions}>
      {[...counts].map(([emoji, { count, mine }]) => (
        <li key={emoji}>
          <button
            type="button"
            onClick={() => onToggle(emoji)}
            aria-pressed={mine}
            className={cn(
              'border-background flex h-6 items-center gap-0.5 rounded-full border-2 px-1.5 text-sm leading-none',
              mine ? 'bg-accent/30' : 'bg-surface',
            )}
          >
            <span aria-hidden>{emoji}</span>
            {count > 1 && <span className="text-xs">{count}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
