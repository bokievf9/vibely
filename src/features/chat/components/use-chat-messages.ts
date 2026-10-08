'use client'

import { useEffect, useRef, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import { loadMessagesAfter, markRead } from '../actions'
import { toChatMessage, type MessageRow } from '../message-row'
import type { ChatMessage } from '../types'
import { signalUnreadChanged } from '../unread-signal'

const byTime = (a: ChatMessage, b: ChatMessage) => a.createdAt.localeCompare(b.createdAt)

// Live message list: initial history from the server + INSERTs over Realtime (RLS-filtered),
// UPDATEs carry read receipts (read_at). Whenever the postgres_changes subscription becomes ready
// (first join or reconnect), messages sent in the meantime are fetched, so nothing falls into the gap.
export function useChatMessages(matchId: string, viewerId: string, initial: ChatMessage[]) {
  const [messages, setMessages] = useState(initial)
  const latest = useRef(initial.at(-1)?.createdAt ?? null)

  const read = () => void markRead(matchId).then(signalUnreadChanged)

  const merge = (incoming: ChatMessage[]) => {
    if (!incoming.length) return
    setMessages((prev) => {
      const fresh = new Map(incoming.map((m) => [m.id, m]))
      const kept = prev.map((p) => fresh.get(p.id) ?? p)
      const seen = new Set(prev.map((p) => p.id))
      const next = [...kept, ...incoming.filter((m) => !seen.has(m.id))].sort(byTime)
      latest.current = next.at(-1)?.createdAt ?? latest.current
      return next
    })
    if (incoming.some((m) => m.senderId !== viewerId && !m.readAt)) read()
  }

  // Older pages go in front; they never move `latest`.
  const prepend = (older: ChatMessage[]) =>
    setMessages((prev) => {
      const seen = new Set(prev.map((p) => p.id))
      return [...older.filter((m) => !seen.has(m.id)), ...prev]
    })

  const markSeen = (row: MessageRow) =>
    setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, readAt: row.read_at } : m)))

  useEffect(() => {
    read()
    const client = getBrowserClient()
    const filter = `match_id=eq.${matchId}`
    const channel = client
      .channel(`match:${matchId}`, { config: { private: true } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter },
        ({ new: row }) => merge([toChatMessage(row as MessageRow)]),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter },
        ({ new: row }) => markSeen(row as MessageRow),
      )
      .on('system', {}, (payload: { extension?: string; status?: string }) => {
        if (payload.extension === 'postgres_changes' && payload.status === 'ok') {
          void loadMessagesAfter(matchId, latest.current).then(merge)
        }
      })
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- merge only touches state setters and refs
  }, [matchId, viewerId])

  return { messages, add: (m: ChatMessage) => merge([m]), prepend }
}
