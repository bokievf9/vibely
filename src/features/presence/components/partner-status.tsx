'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { getPartnerLastSeen } from '../actions'
import { lastSeenText, ONLINE_MS } from '../last-seen'

const REFRESH_MS = 60_000

// Chat header subtitle: "online" / "last seen …", or `fallback` (the @username) while loading and
// when either side hides last seen. The line always takes its height, so the header never shifts
// when the status arrives; the text cross-fades instead.
export function PartnerStatus({ matchId, fallback }: { matchId: string; fallback?: string }) {
  const { dict, locale } = useI18n()
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (document.visibilityState !== 'visible') return
      const result = await getPartnerLastSeen(matchId)
      if (!alive || !result.ok) return
      setLastSeen(result.data)
      setNow(new Date())
    }
    void load()
    const timer = setInterval(load, REFRESH_MS)
    document.addEventListener('visibilitychange', load)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', load)
    }
  }, [matchId])

  const online = !!lastSeen && now.getTime() - Date.parse(lastSeen) < ONLINE_MS
  const text = lastSeen ? lastSeenText(lastSeen, locale, dict.chats, now) : fallback
  return (
    <span className="relative block h-4 min-w-0 text-xs leading-4">
      <span
        key={lastSeen ? 'status' : 'fallback'}
        className={cn(
          'block truncate transition-opacity duration-200 ease-out starting:opacity-0',
          online ? 'text-accent' : 'text-muted',
        )}
      >
        {text ?? ' '}
      </span>
    </span>
  )
}
