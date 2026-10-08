'use client'

import { useEffect, useRef } from 'react'
import { z } from 'zod'
import { getBrowserClient } from '@/lib/supabase/client'
import type { CallEvent } from '../types'

const payloadSchema = z.object({
  call_id: z.uuid().optional(),
  match_id: z.uuid().nullable().optional(),
  status: z.enum(['ringing', 'active', 'ended', 'missed', 'declined']).optional(),
})

function toEvent(event: string, raw: unknown): CallEvent | null {
  const p = payloadSchema.safeParse(raw)
  if (!p.success) return null
  const { call_id: callId, match_id: matchId = null, status } = p.data
  if (event === 'permission') return matchId ? { type: 'permission', matchId } : null
  if (!callId) return null
  if (event === 'incoming') return { type: 'incoming', callId, matchId }
  if (event === 'answered') return { type: 'answered', callId }
  if (event === 'ended') return { type: 'ended', callId, status: status ?? 'ended' }
  return null
}

// The private, read-only call:<user id> topic: the database pushes call signalling here.
// onReady fires on every (re)subscribe so a ring sent while offline is picked up by a re-fetch.
export function useCallChannel(
  userId: string,
  handlers: { onEvent: (e: CallEvent) => void; onReady: () => void },
) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    const client = getBrowserClient()
    const channel = client
      .channel(`call:${userId}`, { config: { private: true } })
      .on(
        'broadcast',
        { event: '*' },
        ({ event, payload }: { event: string; payload: unknown }) => {
          const e = toEvent(event, payload)
          if (e) ref.current.onEvent(e)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') ref.current.onReady()
      })
    return () => {
      void client.removeChannel(channel)
    }
  }, [userId])
}
