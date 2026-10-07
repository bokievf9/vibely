'use client'

import { useEffect, useRef, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import { loadMessagesAfter, markRead } from '../actions'
import type { ChatMessage } from '../types'

const byTime = (a: ChatMessage, b: ChatMessage) => a.createdAt.localeCompare(b.createdAt)

// Live message list: initial history from the server + INSERTs over Realtime (RLS-filtered).
// Whenever the postgres_changes subscription becomes ready (first join or reconnect), messages
// sent in the meantime are fetched, so nothing falls into the gap.
export function useChatMessages(matchId: string, viewerId: string, initial: ChatMessage[]) {
  const [messages, setMessages] = useState(initial)
  const latest = useRef(initial.at(-1)?.createdAt ?? null)

  const merge = (incoming: ChatMessage[]) => {
    if (!incoming.length) return
    setMessages((prev) => {
      const seen = new Set(prev.map((p) => p.id))
      const next = [...prev, ...incoming.filter((m) => !seen.has(m.id))].sort(byTime)
      latest.current = next.at(-1)?.createdAt ?? latest.current
      return next
    })
    if (incoming.some((m) => m.senderId !== viewerId)) void markRead(matchId)
  }

  useEffect(() => {
    void markRead(matchId)
    const client = getBrowserClient()
    const channel = client
      .channel(`match:${matchId}`, { config: { private: true } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        ({ new: row }) => {
          const m = row as { id: string; body: string; sender_id: string; created_at: string }
          merge([{ id: m.id, body: m.body, senderId: m.sender_id, createdAt: m.created_at }])
        },
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

  return { messages, add: (m: ChatMessage) => merge([m]) }
}
