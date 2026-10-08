'use client'

import { ImageIcon, Mic, Video } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { MediaKind, ReplyPreview } from '../types'

const ICONS = { image: ImageIcon, voice: Mic, video: Video } satisfies Record<MediaKind, unknown>

type Props = {
  quote: ReplyPreview
  author: string
  mine: boolean
  onClick?: () => void
  className?: string
}

// The quoted message inside a reply bubble (and above the composer while replying).
export function MessageQuote({ quote, author, mine, onClick, className }: Props) {
  const { dict } = useI18n()
  const labels = { image: dict.chats.photo, voice: dict.media.voice, video: dict.media.video }
  const kind = quote.deleted ? null : quote.mediaKind
  const Icon = kind && ICONS[kind]
  const text = quote.deleted ? dict.chats.deleted : quote.body || (kind ? labels[kind] : '')
  const content = (
    <>
      <span className="block truncate text-xs font-semibold">{author}</span>
      <span className={cn('flex items-center gap-1 truncate text-sm', quote.deleted && 'italic')}>
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
        <span className="truncate">{text}</span>
      </span>
    </>
  )
  const style = cn(
    'block w-full min-w-0 rounded-lg border-l-2 px-2 py-1 text-left',
    mine ? 'border-accent-foreground/70 bg-black/10' : 'border-accent bg-white/5',
    className,
  )
  return onClick ? (
    <button
      type="button"
      className={style}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {content}
    </button>
  ) : (
    <div className={style}>{content}</div>
  )
}
