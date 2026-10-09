'use client'

import { useEffect, useState } from 'react'
import { loadReferralCard } from '../actions'
import type { ReferralCard } from '../types'

// Shared per page: the same card is rendered by the message and by the pinned note of the matched
// chat, and the list re-renders on every Realtime row. A cached card shows at once and is
// refreshed when it is older than FRESH_MS, so a decision of the other person (B accepted, the
// match was made) shows up when the chat is opened again.
const FRESH_MS = 15_000
const cache = new Map<string, { card: ReferralCard | null; at: number }>()
const inflight = new Map<string, Promise<ReferralCard | null>>()

function fetchCard(referralId: string): Promise<ReferralCard | null> {
  let request = inflight.get(referralId)
  if (!request) {
    request = loadReferralCard(referralId)
      .catch(() => cache.get(referralId)?.card ?? null)
      .then((card) => {
        cache.set(referralId, { card, at: Date.now() })
        inflight.delete(referralId)
        return card
      })
    inflight.set(referralId, request)
  }
  return request
}

export function useReferralCard(referralId: string) {
  const [card, setCard] = useState<ReferralCard | null | undefined>(() =>
    cache.has(referralId) ? cache.get(referralId)?.card : undefined,
  )

  useEffect(() => {
    const cached = cache.get(referralId)
    if (cached && Date.now() - cached.at < FRESH_MS) return
    let live = true
    void fetchCard(referralId).then((c) => live && setCard(c))
    return () => {
      live = false
    }
  }, [referralId])

  const update = (next: ReferralCard | null) => {
    cache.set(referralId, { card: next, at: Date.now() })
    setCard(next)
  }

  return { card, loading: card === undefined, update }
}
