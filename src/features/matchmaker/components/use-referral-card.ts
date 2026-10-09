'use client'

import { useEffect, useState } from 'react'
import { loadReferralCard } from '../actions'
import type { ReferralCard } from '../types'

// One fetch per referral per page: the chat list re-renders on every Realtime row, and the same
// card is rendered by the message and by the pinned note of the matched chat.
const cache = new Map<string, ReferralCard | null>()
const inflight = new Map<string, Promise<ReferralCard | null>>()

export function useReferralCard(referralId: string) {
  const [card, setCard] = useState<ReferralCard | null | undefined>(() =>
    cache.has(referralId) ? cache.get(referralId) : undefined,
  )

  useEffect(() => {
    if (cache.has(referralId)) return
    let live = true
    let request = inflight.get(referralId)
    if (!request) {
      request = loadReferralCard(referralId)
        .catch(() => null)
        .then((c) => {
          cache.set(referralId, c)
          inflight.delete(referralId)
          return c
        })
      inflight.set(referralId, request)
    }
    void request.then((c) => live && setCard(c))
    return () => {
      live = false
    }
  }, [referralId])

  const update = (next: ReferralCard | null) => {
    cache.set(referralId, next)
    setCard(next)
  }

  return { card, loading: card === undefined, update }
}
