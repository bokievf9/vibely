'use client'

import { useEffect, useRef } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import type { MessageRow, ReactionRow } from '../message-row'

export type ChannelHandlers = {
  onInsert: (row: MessageRow) => void
  onUpdate: (row: MessageRow) => void
  onReaction: (row: ReactionRow) => void
  // postgres_changes attached (first join or reconnect): resync what may have been missed.
  onReady: () => void
  // The partner read the chat up to `at` (20261009000290; broadcast only to a sender allowed to
  // see read receipts).
  onRead?: (payload: unknown) => void
}

// One private match:<id> channel (read-only for clients) carrying postgres_changes on messages
// and message_reactions, both filtered by match_id and RLS-checked per subscriber, and the 'read'
// broadcast of mark_match_read.
export function useChatChannel(matchId: string, handlers: ChannelHandlers) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    const client = getBrowserClient()
    const filter = `match_id=eq.${matchId}`
    const messages = { schema: 'public', table: 'messages', filter } as const
    const reactions = { schema: 'public', table: 'message_reactions', filter } as const
    const channel = client
      .channel(`match:${matchId}`, { config: { private: true } })
      .on('postgres_changes', { event: 'INSERT', ...messages }, ({ new: row }) =>
        ref.current.onInsert(row as MessageRow),
      )
      .on('postgres_changes', { event: 'UPDATE', ...messages }, ({ new: row }) =>
        ref.current.onUpdate(row as MessageRow),
      )
      .on('postgres_changes', { event: 'INSERT', ...reactions }, ({ new: row }) =>
        ref.current.onReaction(row as ReactionRow),
      )
      .on('postgres_changes', { event: 'UPDATE', ...reactions }, ({ new: row }) =>
        ref.current.onReaction(row as ReactionRow),
      )
      .on('broadcast', { event: 'read' }, ({ payload }) => ref.current.onRead?.(payload))
      .on('system', {}, (payload: { extension?: string; status?: string }) => {
        if (payload.extension === 'postgres_changes' && payload.status === 'ok') {
          ref.current.onReady()
        }
      })
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [matchId])
}
