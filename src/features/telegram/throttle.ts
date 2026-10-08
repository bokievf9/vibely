// Flood control for the moderators chat (Telegram allows ~20 messages per minute in a group).
// A sliding window lets `limit` notifications through per `windowMs`; the rest are counted per
// kind and later collapsed into one summary message. Dedupe keys drop repeats (for example the
// same burst alert) for `ttlMs`. Pure and in-memory: the app runs as a single PM2 process.

export type Throttle = {
  // 'send': go ahead. 'suppressed': over the limit (counted for the summary). 'duplicate':
  // the dedupe key was used within its ttl (dropped, not counted).
  take(kind: string, dedupeKey?: string, ttlMs?: number): 'send' | 'suppressed' | 'duplicate'
  // Counts of suppressed notifications since the last call, or null when nothing was dropped
  // and the window has room for the summary itself.
  drainSummary(): Record<string, number> | null
  // Earliest time (ms) the summary may be sent.
  nextSlotAt(): number
}

export function createThrottle(opts: {
  limit: number
  windowMs?: number
  now?: () => number
}): Throttle {
  const windowMs = opts.windowMs ?? 60_000
  const now = opts.now ?? Date.now
  const limit = Math.max(1, opts.limit)
  let sent: number[] = []
  let suppressed: Record<string, number> = {}
  const seen = new Map<string, number>()

  const prune = (t: number) => {
    sent = sent.filter((s) => t - s < windowMs)
    if (seen.size > 500) for (const [k, until] of seen) if (until <= t) seen.delete(k)
  }

  return {
    take(kind, dedupeKey, ttlMs = 10 * 60_000) {
      const t = now()
      prune(t)
      if (dedupeKey) {
        const until = seen.get(dedupeKey)
        if (until !== undefined && until > t) return 'duplicate'
      }
      // Keep one slot free for the summary while something is waiting to be reported.
      const reserve = Object.keys(suppressed).length ? 1 : 0
      if (sent.length + reserve >= limit) {
        suppressed[kind] = (suppressed[kind] ?? 0) + 1
        return 'suppressed'
      }
      sent.push(t)
      if (dedupeKey) seen.set(dedupeKey, t + ttlMs)
      return 'send'
    },
    drainSummary() {
      const t = now()
      prune(t)
      if (!Object.keys(suppressed).length || sent.length >= limit) return null
      const out = suppressed
      suppressed = {}
      sent.push(t)
      return out
    },
    nextSlotAt() {
      const t = now()
      prune(t)
      if (sent.length < limit) return t
      return (sent[0] ?? t) + windowMs
    },
  }
}
