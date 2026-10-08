'use client'

import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Ban, MoreHorizontal, Reply } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { formatTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { RiskWarning } from '@/features/safety/components/risk-warning'
import type { ChatMessage, Reaction, ReactionEmoji, ReplyPreview } from '../types'
import { MessageQuote } from './message-quote'
import { MessageReactions } from './message-reactions'
import { usePressGestures } from './use-press-gestures'

export type BubbleAction =
  | { type: 'reply' | 'menu' | 'openImage' | 'imageError' }
  | { type: 'react'; emoji: ReactionEmoji }
  | { type: 'jump'; id: string }

type Props = {
  message: ChatMessage
  mine: boolean
  quote: ReplyPreview | null
  quoteAuthor: string
  tail: boolean
  seen: boolean
  highlighted: boolean
  reactions: Reaction[]
  viewerId: string
  onAction: (action: BubbleAction) => void
}

const SWIPE_REPLY_PX = 56
const IMAGE_MAX_PX = 240

export function MessageBubble(props: Props) {
  const { message: m, mine, quote, tail, onAction } = props
  const { dict, locale } = useI18n()
  const deleted = !!m.deletedAt
  const x = useMotionValue(0)
  const replyHint = useTransform(x, [0, SWIPE_REPLY_PX], [0, 1])
  const gestures = usePressGestures({
    onLongPress: () => !deleted && onAction({ type: 'menu' }),
    onDoubleTap: () => !deleted && onAction({ type: 'react', emoji: '❤️' }),
    onTap: m.image ? () => onAction({ type: 'openImage' }) : undefined,
  })
  const imageWidth = m.image ? Math.min(IMAGE_MAX_PX, m.image.width) : 0

  return (
    <div className={cn('group flex flex-col gap-0.5', mine ? 'items-end' : 'items-start')}>
      <div className="relative flex max-w-full items-center gap-1">
        <motion.span
          style={{ opacity: replyHint }}
          className="text-muted absolute top-1/2 left-1 -translate-y-1/2"
          aria-hidden
        >
          <Reply className="size-5" />
        </motion.span>
        {mine && !deleted && (
          <MenuButton onClick={() => onAction({ type: 'menu' })} label={dict.chats.more} />
        )}
        <motion.div
          drag={deleted ? false : 'x'}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 0.5 }}
          dragSnapToOrigin
          style={{ x }}
          onDragEnd={(_, info) => info.offset.x > SWIPE_REPLY_PX && onAction({ type: 'reply' })}
          {...gestures}
          className={cn(
            'relative z-10 flex min-w-0 flex-col gap-1 overflow-hidden rounded-2xl break-words whitespace-pre-wrap transition-shadow select-none [-webkit-touch-callout:none]',
            mine ? 'bg-accent text-accent-foreground' : 'bg-surface',
            tail && (mine ? 'rounded-br-md' : 'rounded-bl-md'),
            m.image && !deleted ? 'p-1' : 'px-3.5 py-2',
            props.highlighted && 'ring-accent ring-2 ring-offset-2 ring-offset-transparent',
          )}
        >
          {quote && !deleted && (
            <MessageQuote
              quote={quote}
              author={props.quoteAuthor}
              mine={mine}
              onClick={() => onAction({ type: 'jump', id: quote.id })}
            />
          )}
          {deleted ? (
            <span className="flex items-center gap-1.5 italic opacity-70">
              <Ban className="size-4" aria-hidden /> {dict.chats.deleted}
            </span>
          ) : (
            <>
              {m.image && (
                <span
                  className="bg-background/30 block overflow-hidden rounded-xl"
                  style={{ width: imageWidth, aspectRatio: `${m.image.width} / ${m.image.height}` }}
                >
                  {m.image.url && (
                    // eslint-disable-next-line @next/next/no-img-element -- private signed URL, never via the optimizer
                    <img
                      src={m.image.url}
                      alt={dict.chats.photo}
                      width={m.image.width}
                      height={m.image.height}
                      draggable={false}
                      onError={() => onAction({ type: 'imageError' })}
                      className="size-full object-cover"
                    />
                  )}
                </span>
              )}
              {m.body && <p className={cn(m.image && 'px-2.5 pb-1')}>{m.body}</p>}
            </>
          )}
        </motion.div>
        {!mine && !deleted && (
          <MenuButton onClick={() => onAction({ type: 'menu' })} label={dict.chats.more} />
        )}
      </div>
      <MessageReactions
        reactions={props.reactions}
        viewerId={props.viewerId}
        onToggle={(emoji) => onAction({ type: 'react', emoji })}
      />
      {(tail || (m.editedAt && !deleted)) && (
        <span className="text-muted px-1 text-[10px]">
          {m.editedAt && !deleted && <>{dict.chats.edited} · </>}
          <time dateTime={m.createdAt}>{formatTime(m.createdAt, locale)}</time>
          {props.seen && <> · {dict.chats.seen}</>}
        </span>
      )}
      {!mine && m.body && !deleted && <RiskWarning text={m.body} />}
    </div>
  )
}

// Desktop affordance: appears on hover; touch devices use long press instead.
function MenuButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-muted hidden shrink-0 rounded-full p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:block"
    >
      <MoreHorizontal className="size-4" />
    </button>
  )
}
