'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { AnimatePresence } from 'framer-motion'
import { Flag, ImageOff, ShieldCheck } from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { dayKey, formatDay, formatTime } from '@/i18n/format'
import { getBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { MediaViewer, type ViewerState } from '@/features/chat/components/media-viewer'
import { ScrollDownButton } from '@/features/chat/components/scroll-down-button'
import { TypingBubble } from '@/features/chat/components/typing-bubble'
import { useFlash } from '@/features/chat/components/use-flash'
import { useStickToBottom } from '@/features/chat/components/use-stick-to-bottom'
import { signalUnreadChanged } from '@/features/chat/unread-signal'
import { ReportDialog } from '@/features/safety/components/report-dialog'
import {
  hydrateGroupRow,
  loadGroupMessagesAfter,
  loadGroupMessagesBefore,
  markGroupRead,
} from '../actions'
import { toGroupMessage, type GroupMember, type GroupMessage, type GroupMessageRow } from '../types'
import { GroupComposer } from './group-composer'

type Props = {
  groupId: string
  viewerId: string
  members: GroupMember[]
  initialMessages: GroupMessage[]
  initialHasMore: boolean
}

const THROTTLE_MS = 2_500
const VISIBLE_MS = 4_000

// The 4-person duo chat: live over the private topic group:<id> (postgres_changes, current members
// only), typing over group-typing:<id>. Text and photos; any other member's message can be reported.
export function GroupRoom({ groupId, viewerId, members, initialMessages, initialHasMore }: Props) {
  const { dict, locale } = useI18n()
  const t = dict.duo
  const errorText = useErrorText()
  const [messages, setMessages] = useState(initialMessages)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingEarlier, startLoading] = useTransition()
  const [error, setError] = useFlash<ErrorKey>()
  const [removed, setRemoved] = useState(false)
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [menuFor, setMenuFor] = useState<GroupMessage | null>(null)
  const [reporting, setReporting] = useState<string | null>(null)
  const typing = useGroupTyping(groupId, viewerId, members)
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const nameOf = (id: string | null) => (id && byId.get(id)?.name) || 'Vibely'

  const add = useCallback((m: GroupMessage) => {
    setMessages((prev) =>
      prev.some((p) => p.id === m.id)
        ? prev
        : [...prev, m].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    )
  }, [])

  const markRead = useCallback(() => {
    if (document.visibilityState !== 'visible') return
    void markGroupRead(groupId).then(() => signalUnreadChanged())
  }, [groupId])

  const last = messages.at(-1)
  const { scrollRef, away, unseen, toBottom } = useStickToBottom(
    last?.id,
    last?.senderId === viewerId,
    typing.names.length > 0,
  )

  useEffect(() => {
    markRead()
    const onVisible = () => markRead()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [markRead, last?.id])

  // Live messages; after a (re)join, fetch what may have been missed.
  const lastAt = useRef(last?.createdAt)
  useEffect(() => {
    lastAt.current = last?.createdAt
  })
  useEffect(() => {
    const client = getBrowserClient()
    const onRow = async (row: GroupMessageRow) => {
      if (row.kind === 'system' && row.about_user === viewerId) setRemoved(true)
      if (row.sender_id) typing.clear(row.sender_id)
      if (row.kind === 'image') {
        const result = await hydrateGroupRow(row)
        if (result.ok) add(result.data)
      } else add(toGroupMessage(row))
    }
    const channel = client
      .channel(`group:${groupId}`, { config: { private: true } })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        ({ new: row }) => void onRow(row as GroupMessageRow),
      )
      .on('system', {}, async (payload: { extension?: string; status?: string }) => {
        if (
          payload.extension !== 'postgres_changes' ||
          payload.status !== 'ok' ||
          !lastAt.current
        ) {
          return
        }
        const result = await loadGroupMessagesAfter({ groupId, after: lastAt.current })
        if (result.ok) result.data.forEach(add)
      })
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
    // typing.clear is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, viewerId, add])

  const loadEarlier = () =>
    startLoading(async () => {
      const oldest = messages[0]
      if (!oldest) return
      const result = await loadGroupMessagesBefore({ groupId, before: oldest.createdAt })
      if (!result.ok) return setError(result.error)
      setMessages((prev) => [
        ...result.data.messages.filter((m) => !prev.some((p) => p.id === m.id)),
        ...prev,
      ])
      setHasMore(result.data.hasMore)
    })

  const systemText = (m: GroupMessage) => {
    if (m.systemEvent === 'matched') return t.systemMatched
    if (m.aboutUser === viewerId) return t.youLeft
    const name = nameOf(m.aboutUser)
    return fmt(m.systemEvent === 'removed' ? t.systemRemoved : t.systemLeft, { name })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col-reverse overflow-x-hidden overflow-y-auto overscroll-contain [overflow-anchor:none]"
      >
        <div className="flex shrink-0 flex-col pt-[var(--header-h)]">
          <p className="text-muted mx-6 mt-4 mb-2 flex items-start gap-2 rounded-2xl bg-white/[0.04] px-3 py-2.5 text-xs leading-relaxed">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {t.recordingNote} {t.noCalls}
            </span>
          </p>
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="mx-auto my-2"
              loading={loadingEarlier}
              onClick={loadEarlier}
            >
              {dict.chats.loadEarlier}
            </Button>
          )}
          <ol className="flex flex-col px-3 pb-3">
            {messages.map((m, i) => {
              const prev = messages[i - 1]
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)
              const day = newDay && (
                <li className="text-muted my-3 self-center text-xs font-semibold">
                  {formatDay(m.createdAt, locale)}
                </li>
              )
              if (m.kind === 'system') {
                return (
                  <Fragment key={m.id}>
                    {day}
                    <li className="text-muted my-2 self-center rounded-full bg-white/[0.05] px-3 py-1 text-center text-xs">
                      {systemText(m)}
                    </li>
                  </Fragment>
                )
              }
              const mine = m.senderId === viewerId
              const sender = m.senderId ? byId.get(m.senderId) : undefined
              const firstOfRun = newDay || prev?.senderId !== m.senderId || prev?.kind === 'system'
              return (
                <Fragment key={m.id}>
                  {day}
                  <li
                    className={cn(
                      'flex max-w-[85%] items-end gap-2',
                      mine ? 'self-end' : 'self-start',
                      firstOfRun ? 'mt-3' : 'mt-1',
                    )}
                  >
                    {!mine && (
                      <span className="w-8 shrink-0">
                        {firstOfRun && (
                          <Avatar
                            photo={sender?.photo ?? null}
                            alt={nameOf(m.senderId)}
                            size={32}
                          />
                        )}
                      </span>
                    )}
                    <div
                      className={cn('flex min-w-0 flex-col', mine ? 'items-end' : 'items-start')}
                    >
                      {!mine && firstOfRun && (
                        <span className="text-muted mb-0.5 px-3 text-xs font-semibold">
                          {nameOf(m.senderId)}
                        </span>
                      )}
                      <Bubble
                        message={m}
                        mine={mine}
                        time={formatTime(m.createdAt, locale)}
                        onOpen={(origin) =>
                          m.image?.url &&
                          setViewer({
                            media: { kind: 'image', ...m.image },
                            origin,
                            messageId: m.id,
                          })
                        }
                        onMenu={() => !mine && setMenuFor(m)}
                      />
                    </div>
                  </li>
                </Fragment>
              )
            })}
            <AnimatePresence>
              {typing.names.length > 0 && (
                <TypingBubble key="typing" name={typing.names.join(', ')} />
              )}
            </AnimatePresence>
          </ol>
        </div>
      </div>
      {removed ? (
        <p className="text-muted shrink-0 px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm">
          {t.youLeft}
        </p>
      ) : (
        <GroupComposer
          groupId={groupId}
          error={errorText(error ?? undefined)}
          aside={<ScrollDownButton visible={away} unseen={unseen} onClick={toBottom} />}
          onSent={add}
          onError={(e) => setError(e)}
          onTyping={typing.notify}
        />
      )}
      <Modal
        open={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={nameOf(menuFor?.senderId ?? null)}
      >
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setReporting(menuFor?.id ?? null)
            setMenuFor(null)
          }}
        >
          <Flag className="size-5" aria-hidden /> {dict.reports.reportMessage}
        </Button>
      </Modal>
      <ReportDialog
        key={reporting ?? 'none'}
        open={reporting !== null}
        onClose={() => setReporting(null)}
        targetType="group_message"
        targetId={reporting ?? ''}
        title={dict.reports.messageTitle}
        note={dict.reports.reviewNote}
      />
      <MediaViewer viewer={viewer} onClose={() => setViewer(null)} />
    </div>
  )
}

function Bubble({
  message: m,
  mine,
  time,
  onOpen,
  onMenu,
}: {
  message: GroupMessage
  mine: boolean
  time: string
  onOpen: (origin: DOMRect | null) => void
  onMenu: () => void
}) {
  const { dict } = useI18n()
  const press = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Long press (or right click) on someone else's message: the report menu.
  const handlers = mine
    ? {}
    : {
        onContextMenu: (e: React.MouseEvent) => {
          e.preventDefault()
          onMenu()
        },
        onPointerDown: () => {
          press.current = setTimeout(onMenu, 500)
        },
        onPointerUp: () => clearTimeout(press.current),
        onPointerLeave: () => clearTimeout(press.current),
        onPointerCancel: () => clearTimeout(press.current),
      }
  const base = cn(
    'relative overflow-hidden rounded-[1.25rem] select-none [-webkit-touch-callout:none]',
    mine
      ? 'bg-accent-gradient text-accent-foreground rounded-br-[0.375rem]'
      : 'bg-surface-raised rounded-bl-[0.375rem] shadow-[inset_0_0_0_1px_var(--border)]',
  )
  if (m.kind === 'image') {
    if (!m.image?.url) {
      return (
        <div
          className={cn(base, 'text-muted flex items-center gap-2 px-3.5 py-2 text-sm')}
          {...handlers}
        >
          <ImageOff className="size-4" aria-hidden />
          {m.expired ? dict.media.previewExpired : dict.duo.photoPreview}
        </div>
      )
    }
    const ratio = m.image.width / m.image.height
    return (
      <button
        type="button"
        className={cn(base, 'block p-0')}
        style={{ width: ratio >= 1 ? 240 : Math.max(140, 240 * ratio) }}
        onClick={(e) => onOpen(e.currentTarget.getBoundingClientRect())}
        aria-label={`${dict.duo.photoPreview}, ${time}`}
        {...handlers}
      >
        <Image
          src={m.image.url}
          alt=""
          width={m.image.width}
          height={m.image.height}
          sizes="240px"
          className="h-auto w-full object-cover"
          draggable={false}
        />
        <span className="absolute right-2 bottom-1.5 rounded-full bg-black/45 px-1.5 text-[11px] text-white tabular-nums">
          {time}
        </span>
      </button>
    )
  }
  return (
    <div className={cn(base, 'px-3.5 py-2')} {...handlers}>
      <p className="text-[1rem] leading-snug [overflow-wrap:anywhere] whitespace-pre-wrap select-text">
        {m.body}
        <span
          className={cn(
            'float-right mt-1.5 ml-2 text-[11px] tabular-nums',
            mine ? 'text-accent-foreground/70' : 'text-muted',
          )}
        >
          {time}
        </span>
      </p>
    </div>
  )
}

// Who is typing (names), over the writable broadcast topic group-typing:<group id>.
function useGroupTyping(groupId: string, viewerId: string, members: GroupMember[]) {
  const [typing, setTyping] = useState<string[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastSent = useRef(0)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const clear = useCallback((id: string) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setTyping((prev) => prev.filter((p) => p !== id))
  }, [])

  useEffect(() => {
    const client = getBrowserClient()
    const all = timers.current
    const channel = client
      .channel(`group-typing:${groupId}`, { config: { private: true } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const from = (payload as { from?: string }).from
        if (!from || from === viewerId) return
        setTyping((prev) => (prev.includes(from) ? prev : [...prev, from]))
        clearTimeout(all.get(from))
        all.set(
          from,
          setTimeout(() => clear(from), VISIBLE_MS),
        )
      })
      .subscribe()
    channelRef.current = channel
    return () => {
      channelRef.current = null
      all.forEach((timer) => clearTimeout(timer))
      all.clear()
      void client.removeChannel(channel)
    }
  }, [groupId, viewerId, clear])

  const notify = useCallback(() => {
    const now = Date.now()
    if (now - lastSent.current < THROTTLE_MS) return
    lastSent.current = now
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { from: viewerId },
    })
  }, [viewerId])

  // Only people who are still in the chat.
  const names = typing.flatMap((id) => {
    const m = members.find((p) => p.id === id && !p.left)
    return m ? [m.name] : []
  })
  return { names, notify, clear }
}
