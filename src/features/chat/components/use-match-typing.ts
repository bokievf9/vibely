'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getBrowserClient } from '@/lib/supabase/client'

const THROTTLE_MS = 2_500
const VISIBLE_MS = 4_000

// Typing indicator over the private broadcast topic match-typing:<match id> — the only match
// topic clients may write to (match:<id> stays read-only). Sends are throttled; the indicator
// hides after a few quiet seconds or when the partner's message arrives (`clear`).
export function useMatchTyping(matchId: string, viewerId: string) {
  const [partnerTyping, setPartnerTyping] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastSent = useRef(0)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const client = getBrowserClient()
    const channel = client
      .channel(`match-typing:${matchId}`, { config: { private: true } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if ((payload as { from?: string }).from === viewerId) return
        setPartnerTyping(true)
        clearTimeout(hideTimer.current)
        hideTimer.current = setTimeout(() => setPartnerTyping(false), VISIBLE_MS)
      })
      .subscribe()
    channelRef.current = channel
    return () => {
      channelRef.current = null
      clearTimeout(hideTimer.current)
      void client.removeChannel(channel)
    }
  }, [matchId, viewerId])

  const notifyTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastSent.current < THROTTLE_MS) return
    lastSent.current = now
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { from: viewerId },
    })
  }, [viewerId])

  const clear = useCallback(() => {
    clearTimeout(hideTimer.current)
    setPartnerTyping(false)
  }, [])

  return { partnerTyping, notifyTyping, clear }
}
