'use client'

import { useEffect, useRef, useState } from 'react'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { markRead, sendMessage } from '../actions'
import { claimOutgoing, mergeMessages, type Outgoing } from '../chat-state'
import { loadMessagesAfter, loadMessagesById, signChatImages } from '../history-actions'
import { toChatMessage, type MessageRow } from '../message-row'
import type { ChatMessage } from '../types'
import { signalUnreadChanged } from '../unread-signal'

// Live message list: initial history from the server, then Realtime rows (RLS-filtered).
// Realtime rows lack signed media URLs and quoted-message previews, so those are fetched through a
// Server Action and merged in. UPDATEs carry read receipts, edits and deletions.
// Text messages are sent optimistically through `outbox` (pending, then the stored message or
// "not sent" with retry). `fresh` holds ids that just arrived, so only those animate in.
export function useChatMessages(matchId: string, viewerId: string, initial: ChatMessage[]) {
  const [messages, setMessages] = useState(initial)
  const [outbox, setOutboxState] = useState<Outgoing[]>([])
  const outboxRef = useRef<Outgoing[]>([])
  const latest = useRef(initial.at(-1)?.createdAt ?? null)
  const known = useRef(new Set(initial.map((m) => m.id)))
  const resigned = useRef(new Set<string>())
  const fresh = useRef(new Set<string>())

  const setOutbox = (next: (prev: Outgoing[]) => Outgoing[]) => {
    outboxRef.current = next(outboxRef.current)
    setOutboxState(outboxRef.current)
  }

  const read = () => void markRead(matchId).then(signalUnreadChanged)
  // Newest partner message already marked read. With 20261009000290 read_at stays null (the read
  // state lives in match_reads), so "unread" is judged by time here.
  const readUpTo = useRef(initial.at(-1)?.createdAt ?? null)

  const merge = (incoming: ChatMessage[], animate = true) => {
    if (!incoming.length) return
    for (const m of incoming) {
      if (animate && !known.current.has(m.id)) fresh.current.add(m.id)
      known.current.add(m.id)
      if (!latest.current || m.createdAt > latest.current) latest.current = m.createdAt
    }
    setMessages((prev) => mergeMessages(prev, incoming))
    const unread = incoming.filter(
      (m) =>
        m.senderId !== viewerId &&
        !m.readAt &&
        !m.deletedAt &&
        (!readUpTo.current || m.createdAt > readUpTo.current),
    )
    if (unread.length) {
      readUpTo.current = unread.reduce((a, m) => (m.createdAt > a ? m.createdAt : a), '')
      read()
    }
  }

  // Older pages go in front; they never move `latest` and never animate.
  const prepend = (older: ChatMessage[]) => {
    for (const m of older) known.current.add(m.id)
    setMessages((prev) => {
      const seen = new Set(prev.map((p) => p.id))
      return [...older.filter((m) => !seen.has(m.id)), ...prev]
    })
  }

  const hydrate = (ids: string[]) => void loadMessagesById({ matchId, ids }).then((m) => merge(m))

  const onInsert = (row: MessageRow) => {
    const m = toChatMessage(row)
    const needsMore = !!m.media || (!!m.replyTo && !known.current.has(m.replyTo))
    // An own message whose optimistic bubble is already on screen replaces it without animating.
    let claimed = false
    if (m.senderId === viewerId) {
      const result = claimOutgoing(outboxRef.current, m)
      claimed = result.claimed
      if (result.list !== outboxRef.current) setOutbox(() => result.list)
    }
    merge([m], !claimed)
    if (needsMore) hydrate([m.id])
  }

  const onUpdate = (row: MessageRow) => {
    if (!known.current.has(row.id)) return
    setMessages((prev) => mergeMessages(prev, [toChatMessage(row)]))
  }

  const resync = () => void loadMessagesAfter(matchId, latest.current).then((m) => merge(m))

  // Signed URLs expire after an hour: re-sign once when a photo/voice/video fails to load.
  const refreshMedia = (path: string) => {
    if (resigned.current.has(path)) return
    resigned.current.add(path)
    void signChatImages([path]).then((urls) => {
      const url = urls[path]
      if (!url) return
      setMessages((prev) =>
        prev.map((m) => (m.media?.path === path ? { ...m, media: { ...m.media, url } } : m)),
      )
    })
  }

  // Locally applied edits and deletions (the Realtime UPDATE confirms them for both sides).
  const patch = (id: string, change: Partial<ChatMessage>) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...change } : m)))

  const deliver = async (item: Outgoing): Promise<ErrorKey | null> => {
    const result = await sendMessage({ matchId, body: item.body, replyTo: item.replyTo }).catch(
      () => null,
    )
    const current = outboxRef.current.find((o) => o.tempId === item.tempId)
    if (result?.ok) {
      setOutbox((prev) => prev.filter((o) => o.tempId !== item.tempId))
      merge([result.data], false)
      return null
    }
    // Already stored (Realtime claimed it): nothing to retry.
    if (current?.claimedBy) {
      setOutbox((prev) => prev.filter((o) => o.tempId !== item.tempId))
      return null
    }
    setOutbox((prev) =>
      prev.map((o) => (o.tempId === item.tempId ? { ...o, status: 'failed' as const } : o)),
    )
    return result?.error ?? 'generic'
  }

  // Shows the bubble at once and sends in the background. Resolves with the error, if any.
  const send = (body: string, replyTo: string | null) => {
    const item: Outgoing = {
      tempId: `local-${crypto.randomUUID()}`,
      body,
      replyTo,
      createdAt: new Date().toISOString(),
      status: 'pending',
      claimedBy: null,
    }
    fresh.current.add(item.tempId)
    setOutbox((prev) => [...prev, item])
    return deliver(item)
  }

  const retry = (tempId: string) => {
    const item = outboxRef.current.find((o) => o.tempId === tempId)
    if (!item || item.status !== 'failed') return Promise.resolve(null)
    setOutbox((prev) =>
      prev.map((o) => (o.tempId === tempId ? { ...o, status: 'pending' as const } : o)),
    )
    return deliver(item)
  }

  const discard = (tempId: string) => setOutbox((prev) => prev.filter((o) => o.tempId !== tempId))

  useEffect(() => {
    read()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read only depends on matchId
  }, [matchId])

  return {
    messages,
    outbox,
    fresh,
    add: (m: ChatMessage) => merge([m]),
    send,
    retry,
    discard,
    prepend,
    patch,
    onInsert,
    onUpdate,
    resync,
    refreshMedia,
  }
}
