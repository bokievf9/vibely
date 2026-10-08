'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { getPartnerLastSeen } from '../actions'
import { lastSeenText, ONLINE_MS } from '../last-seen'

const REFRESH_MS = 60_000

// Chat header subtitle: "online" / "last seen …". Nothing when either side hides last seen.
export function PartnerStatus({ matchId }: { matchId: string }) {
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

  if (!lastSeen) return null
  const online = now.getTime() - Date.parse(lastSeen) < ONLINE_MS
  return (
    <span className={cn('truncate text-xs', online ? 'text-accent' : 'text-muted')}>
      {lastSeenText(lastSeen, locale, dict.chats, now)}
    </span>
  )
}
