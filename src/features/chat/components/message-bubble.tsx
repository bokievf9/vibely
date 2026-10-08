'use client'

import { useRef, type PointerEvent } from 'react'
import {
  motion,
  useDragControls,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from 'framer-motion'
import { AlertCircle, Ban, Clock, MoreHorizontal, Reply } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { formatTime } from '@/i18n/format'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { RiskWarning } from '@/features/safety/components/risk-warning'
import type { ChatMessage, Reaction, ReactionEmoji, ReplyPreview } from '../types'
import { MessageMedia } from './message-media'
import { MessageQuote } from './message-quote'
import { MessageReactions } from './message-reactions'
import { usePressGestures } from './use-press-gestures'

export type BubbleAction =
  | { type: 'reply' | 'menu' | 'mediaError' }
  | { type: 'openMedia'; origin: DOMRect | null }
  | { type: 'react'; emoji: ReactionEmoji }
  | { type: 'jump'; id: string }

// A stored message, or an optimistic one (`local`) that is still sending or failed.
export type ListMessage = ChatMessage & { local?: 'pending' | 'failed' }

type Props = {
  message: ListMessage
  mine: boolean
  quote: ReplyPreview | null
  quoteAuthor: string
  tail: boolean
  seen: boolean
  highlighted: boolean
  lifted: boolean
  reactions: Reaction[]
  viewerId: string
  onAction: (action: BubbleAction) => void
  onRetry: () => void
  onDiscard: () => void
}

const SWIPE_REPLY_PX = 56

export function MessageBubble(props: Props) {
  const { message: m, mine, quote, tail, onAction } = props
  const { dict, locale } = useI18n()
  const deleted = !!m.deletedAt
  const local = m.local
  const interactive = !deleted && !local
  const kind = deleted ? undefined : m.media?.kind
  const bubbleRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const replyHint = useTransform(x, [8, SWIPE_REPLY_PX], [0, 1])
  const replyScale = useTransform(x, [SWIPE_REPLY_PX - 1, SWIPE_REPLY_PX], [0.85, 1])
  const drag = useDragControls()
  const armed = useRef(false)

  // One tick when the swipe crosses the reply threshold (and none when it goes back).
  useMotionValueEvent(x, 'change', (v) => {
    const over = v >= SWIPE_REPLY_PX
    if (over === armed.current) return
    armed.current = over
    if (over) haptic('light')
  })

  const press = usePressGestures({
    enabled: interactive,
    onLongPress: () => onAction({ type: 'menu' }),
    onDoubleTap: () => onAction({ type: 'react', emoji: '❤️' }),
    onTap:
      kind === 'image' || kind === 'video'
        ? () =>
            onAction({
              type: 'openMedia',
              origin:
                bubbleRef.current?.querySelector('[data-media]')?.getBoundingClientRect() ?? null,
            })
        : undefined,
  })

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    press.handlers.onPointerDown?.(e)
    // Controls inside the bubble (voice scrubbing, quote) own their own drags.
    if (interactive && !(e.target as Element).closest('[data-no-swipe]')) drag.start(e)
  }

  return (
    <div className={cn('group flex flex-col gap-0.5', mine ? 'items-end' : 'items-start')}>
      <div className="relative flex max-w-full items-center gap-1">
        <motion.span
          style={{ opacity: replyHint, scale: replyScale }}
          className="text-muted absolute top-1/2 left-1 -mt-2.5"
          aria-hidden
        >
          <Reply className="size-5" />
        </motion.span>
        {mine && interactive && (
          <MenuButton onClick={() => onAction({ type: 'menu' })} label={dict.chats.more} />
        )}
        {/* Press feedback lives on this wrapper; the swipe transform lives on the bubble. */}
        <div
          className={cn(
            'relative z-10 min-w-0 rounded-2xl',
            mine ? 'origin-right' : 'origin-left',
            props.lifted
              ? 'scale-[1.03] shadow-[0_12px_32px_rgb(0_0_0/0.45)] transition-[transform,scale,box-shadow] duration-200 ease-out'
              : press.pressing
                ? // Slowly sinks over the long-press time: the hold reads as progress.
                  'scale-[0.96] transition-transform duration-[450ms] ease-out'
                : 'transition-[transform,scale,box-shadow] duration-200 ease-out',
          )}
        >
          <motion.div
            ref={bubbleRef}
            drag={interactive ? 'x' : false}
            dragListener={false}
            dragControls={drag}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.5 }}
            dragSnapToOrigin
            style={{ x }}
            onDragEnd={(_, info) => info.offset.x > SWIPE_REPLY_PX && onAction({ type: 'reply' })}
            {...press.handlers}
            onPointerDown={onPointerDown}
            className={cn(
              // pan-y: vertical scrolling stays native, the horizontal swipe is ours (framer only sets
              // touch-action itself when it owns the pointer listener).
              'ring-accent relative flex min-w-0 touch-pan-y flex-col gap-1 overflow-hidden rounded-2xl [overflow-wrap:anywhere] whitespace-pre-wrap select-none [-webkit-touch-callout:none]',
              // Reply-jump highlight: appears fast, fades slowly.
              props.highlighted
                ? 'ring-2 transition-[box-shadow] duration-150'
                : 'ring-0 transition-[box-shadow] duration-700 ease-out',
              kind === 'video'
                ? 'bg-transparent'
                : mine
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-surface',
              tail && kind !== 'video' && (mine ? 'rounded-br-md' : 'rounded-bl-md'),
              kind === 'image' ? 'p-1' : kind === 'video' ? 'p-0' : 'px-3.5 py-2',
              local === 'pending' && 'opacity-75',
              local === 'failed' && 'opacity-60',
            )}
          >
            {quote && !deleted && (
              <MessageQuote
                quote={quote}
                author={props.quoteAuthor}
                mine={mine}
                onClick={local ? undefined : () => onAction({ type: 'jump', id: quote.id })}
              />
            )}
            {deleted ? (
              <span className="flex items-center gap-1.5 italic opacity-70">
                <Ban className="size-4" aria-hidden /> {dict.chats.deleted}
              </span>
            ) : (
              <>
                <MessageMedia
                  message={m}
                  mine={mine}
                  onError={() => onAction({ type: 'mediaError' })}
                />
                {m.body && <p className={cn(kind === 'image' && 'px-2.5 pb-1')}>{m.body}</p>}
              </>
            )}
          </motion.div>
        </div>
        {!mine && interactive && (
          <MenuButton onClick={() => onAction({ type: 'menu' })} label={dict.chats.more} />
        )}
      </div>
      <MessageReactions
        reactions={props.reactions}
        viewerId={props.viewerId}
        onToggle={(emoji) => onAction({ type: 'react', emoji })}
      />
      {local === 'failed' ? (
        <FailedRow
          label={dict.chatui.notSent}
          retry={dict.chatui.retry}
          discard={dict.chatui.discard}
          onRetry={props.onRetry}
          onDiscard={props.onDiscard}
        />
      ) : local === 'pending' ? (
        tail && (
          <span className="text-muted flex items-center gap-1 px-1 text-[11px]">
            <Clock className="size-3" aria-hidden />
            <span className="sr-only">{dict.chatui.sending}</span>
          </span>
        )
      ) : (
        (tail || (m.editedAt && !deleted)) && (
          <span className="text-muted px-1 text-[11px] tabular-nums">
            {m.editedAt && !deleted && <>{dict.chats.edited} · </>}
            <time dateTime={m.createdAt}>{formatTime(m.createdAt, locale)}</time>
            {props.seen && <> · {dict.chats.seen}</>}
          </span>
        )
      )}
      {!mine && m.body && !deleted && <RiskWarning text={m.body} />}
    </div>
  )
}

function FailedRow(props: {
  label: string
  retry: string
  discard: string
  onRetry: () => void
  onDiscard: () => void
}) {
  // TODO(integration): text-danger once the shell tokens land.
  return (
    <span
      role="alert"
      className="text-danger flex flex-wrap items-center justify-end gap-x-1 text-xs"
    >
      <AlertCircle className="size-3.5 shrink-0" aria-hidden />
      {props.label}
      <button
        type="button"
        onClick={props.onRetry}
        className="text-foreground active:bg-surface h-8 rounded-full px-2.5 font-semibold transition-[background-color,transform,scale] duration-150 ease-out active:scale-95"
      >
        {props.retry}
      </button>
      <button
        type="button"
        onClick={props.onDiscard}
        className="text-muted active:bg-surface h-8 rounded-full px-2.5 transition-[background-color,transform,scale] duration-150 ease-out active:scale-95"
      >
        {props.discard}
      </button>
    </span>
  )
}

// Desktop affordance: appears on hover; touch devices use long press instead.
function MenuButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-muted hidden size-8 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:flex"
    >
      <MoreHorizontal className="size-4" />
    </button>
  )
}
