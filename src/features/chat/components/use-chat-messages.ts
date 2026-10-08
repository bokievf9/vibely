'use client'

import { useEffect, useRef, useState } from 'react'
import { markRead } from '../actions'
import { mergeMessages } from '../chat-state'
import { loadMessagesAfter, loadMessagesById, signChatImages } from '../history-actions'
import { toChatMessage, type MessageRow } from '../message-row'
import type { ChatMessage } from '../types'
import { signalUnreadChanged } from '../unread-signal'

// Live message list: initial history from the server, then Realtime rows (RLS-filtered).
// Realtime rows lack signed media URLs and quoted-message previews, so those are fetched through a
// Server Action and merged in. UPDATEs carry read receipts, edits and deletions.
export function useChatMessages(matchId: string, viewerId: string, initial: ChatMessage[]) {
  const [messages, setMessages] = useState(initial)
  const latest = useRef(initial.at(-1)?.createdAt ?? null)
  const known = useRef(new Set(initial.map((m) => m.id)))
  const resigned = useRef(new Set<string>())

  const read = () => void markRead(matchId).then(signalUnreadChanged)

  const merge = (incoming: ChatMessage[]) => {
    if (!incoming.length) return
    for (const m of incoming) {
      known.current.add(m.id)
      if (!latest.current || m.createdAt > latest.current) latest.current = m.createdAt
    }
    setMessages((prev) => mergeMessages(prev, incoming))
    if (incoming.some((m) => m.senderId !== viewerId && !m.readAt && !m.deletedAt)) read()
  }

  // Older pages go in front; they never move `latest`.
  const prepend = (older: ChatMessage[]) => {
    for (const m of older) known.current.add(m.id)
    setMessages((prev) => {
      const seen = new Set(prev.map((p) => p.id))
      return [...older.filter((m) => !seen.has(m.id)), ...prev]
    })
  }

  const hydrate = (ids: string[]) => void loadMessagesById({ matchId, ids }).then(merge)

  const onInsert = (row: MessageRow) => {
    const m = toChatMessage(row)
    const needsMore = !!m.media || (!!m.replyTo && !known.current.has(m.replyTo))
    merge([m])
    if (needsMore) hydrate([m.id])
  }

  const onUpdate = (row: MessageRow) => {
    if (!known.current.has(row.id)) return
    setMessages((prev) => mergeMessages(prev, [toChatMessage(row)]))
  }

  const resync = () => void loadMessagesAfter(matchId, latest.current).then(merge)

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

  useEffect(() => {
    read()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read only depends on matchId
  }, [matchId])

  return {
    messages,
    add: (m: ChatMessage) => merge([m]),
    prepend,
    patch,
    onInsert,
    onUpdate,
    resync,
    refreshMedia,
  }
}
