'use client'

import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getBrowserClient } from '@/lib/supabase/client'
import type { BroadcastMessage, Side } from '../types'

type Handlers = {
  onMessage: (m: BroadcastMessage) => void
  onTyping: (from: Side) => void
  // Both pressed Connect (20261009000190). 'revealed' is the same signal from the old RPCs.
  onMatched: () => void
  // The other person passed or blocked, or a moderator ended the session.
  onEnded: () => void
}

// Private broadcast channels of one blind date; only participants can join (RLS on
// realtime.messages). random:<id> is read-only (the database broadcasts messages, matched,
// ended); typing goes over random-typing:<id>, the only topic clients may write to.
export function useBlindChannel(sessionId: string | null, handlers: Handlers) {
  const ref = useRef(handlers)
  const channelRef = useRef<RealtimeChannel | null>(null)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    if (!sessionId) return
    const client = getBrowserClient()
    const channel = client
      .channel(`random:${sessionId}`, { config: { private: true } })
      .on('broadcast', { event: 'message' }, ({ payload }) =>
        ref.current.onMessage(payload as BroadcastMessage),
      )
      .on('broadcast', { event: 'matched' }, () => ref.current.onMatched())
      .on('broadcast', { event: 'revealed' }, () => ref.current.onMatched())
      .on('broadcast', { event: 'ended' }, () => ref.current.onEnded())
      .subscribe()
    const typing = client
      .channel(`random-typing:${sessionId}`, { config: { private: true } })
      .on('broadcast', { event: 'typing' }, ({ payload }) =>
        ref.current.onTyping((payload as { from: Side }).from),
      )
      .subscribe()
    channelRef.current = typing
    return () => {
      channelRef.current = null
      void client.removeChannel(channel)
      void client.removeChannel(typing)
    }
  }, [sessionId])

  return {
    sendTyping: (from: Side) =>
      void channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { from } }),
  }
}

// The caller's own private topic randomizer:<user id>: 'paired' while waiting in the queue, and
// 'decided' (my own Connect/Pass, so another tab or device of mine stays in sync).
export function useOwnBlindSignals(
  userId: string,
  active: boolean,
  handlers: { onPaired?: () => void; onDecided?: (sessionId: string, connect: boolean) => void },
) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    if (!active) return
    const client = getBrowserClient()
    const channel = client
      .channel(`randomizer:${userId}`, { config: { private: true } })
      .on('broadcast', { event: 'paired' }, () => ref.current.onPaired?.())
      .on('broadcast', { event: 'decided' }, ({ payload }) => {
        const p = payload as { session_id?: string; decision?: boolean }
        if (p.session_id && typeof p.decision === 'boolean')
          ref.current.onDecided?.(p.session_id, p.decision)
      })
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [userId, active])
}
