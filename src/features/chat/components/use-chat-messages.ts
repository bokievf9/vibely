'use client'

import { useEffect, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import { markRead } from '../actions'
import type { ChatMessage } from '../types'

// Live message list: initial history from the server + INSERTs over Realtime (RLS-filtered).
export function useChatMessages(matchId: string, viewerId: string, initial: ChatMessage[]) {
  const [messages, setMessages] = useState(initial)

  const add = (m: ChatMessage) =>
    setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))

  useEffect(() => {
    void markRead(matchId)
    const channel = getBrowserClient()
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        ({ new: row }) => {
          const m = row as { id: string; body: string; sender_id: string; created_at: string }
          add({ id: m.id, body: m.body, senderId: m.sender_id, createdAt: m.created_at })
          if (m.sender_id !== viewerId) void markRead(matchId)
        },
      )
      .subscribe()
    return () => {
      void getBrowserClient().removeChannel(channel)
    }
  }, [matchId, viewerId])

  return { messages, add }
}
