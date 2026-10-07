'use client'

import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getBrowserClient } from '@/lib/supabase/client'
import type { BroadcastMessage, Side } from '../types'

type Handlers = {
  onMessage: (m: BroadcastMessage) => void
  onTyping: (from: Side) => void
  onRevealRequested: (from: Side) => void
  onRevealed: () => void
  onEnded: () => void
}

// Private broadcast channels of one random-chat session; only participants can join (RLS on
// realtime.messages). random:<id> is read-only (the database broadcasts messages, reveal, end);
// typing goes over random-typing:<id>, the only topic clients may write to.
export function useRandomChannel(sessionId: string | null, handlers: Handlers) {
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
      .on('broadcast', { event: 'typing' }, ({ payload }) =>
        ref.current.onTyping((payload as { from: Side }).from),
      )
      .on('broadcast', { event: 'reveal_requested' }, ({ payload }) =>
        ref.current.onRevealRequested((payload as { from: Side }).from),
      )
      .on('broadcast', { event: 'revealed' }, () => ref.current.onRevealed())
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

// "You've been paired" notification for a user waiting in the queue.
export function usePairedSignal(userId: string, active: boolean, onPaired: () => void) {
  const ref = useRef(onPaired)
  useEffect(() => {
    ref.current = onPaired
  })

  useEffect(() => {
    if (!active) return
    const client = getBrowserClient()
    const channel = client
      .channel(`randomizer:${userId}`, { config: { private: true } })
      .on('broadcast', { event: 'paired' }, () => ref.current())
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [userId, active])
}
