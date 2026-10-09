'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchCurrentEvent } from '../actions'
import { clockOffset, countdownTickMs } from '../countdown'
import type { CurrentEvent } from '../types'

const LIVE_POLL_MS = 15_000
const UPCOMING_POLL_MS = 60_000

// Keeps the current night fresh on the client: a ticking "now" (corrected by the server clock)
// for the countdown, a refetch the moment the start passes (the server flips it to live), and a
// slow poll while the hook is mounted (people in the room while live; a moved or cancelled night
// while upcoming). `event` becomes null once there is no night any more. `onRefresh` runs after
// every answer from the server (not on mount).
export function useCurrentEvent(
  initial: CurrentEvent | null,
  onRefresh?: (event: CurrentEvent | null) => void,
) {
  const [event, setEvent] = useState(initial)
  // The first render uses the server's clock as "now" (pure); the offset between the two clocks
  // is measured in an effect and applied from the first tick on.
  const [now, setNow] = useState(() => (initial ? Date.parse(initial.serverNow) : 0))
  const offset = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => {
    onRefreshRef.current = onRefresh
  })
  useEffect(() => {
    if (initial) offset.current = clockOffset(initial.serverNow, Date.now())
  }, [initial])

  const refresh = useCallback(async () => {
    const fresh = await fetchCurrentEvent()
    if (fresh) offset.current = clockOffset(fresh.serverNow, Date.now())
    setEvent(fresh)
    setNow(Date.now() - offset.current)
    onRefreshRef.current?.(fresh)
  }, [])

  const startsAt = event ? Date.parse(event.startsAt) : 0
  const endsAt = event ? Date.parse(event.endsAt) : 0
  const msLeft = startsAt - now
  const live = event?.status === 'live' || (!!event && msLeft <= 0 && now < endsAt)

  // Countdown tick (upcoming only); once it reaches zero, ask the server.
  useEffect(() => {
    if (!event || live) return
    const timer = setTimeout(
      () => {
        if (msLeft <= 0) void refresh()
        else setNow(Date.now() - offset.current)
      },
      msLeft <= 0 ? 0 : countdownTickMs(msLeft),
    )
    return () => clearTimeout(timer)
  }, [event, live, msLeft, refresh])

  // Slow poll while visible.
  useEffect(() => {
    if (!event) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, live ? LIVE_POLL_MS : UPCOMING_POLL_MS)
    return () => clearInterval(timer)
  }, [event, live, refresh])

  const setReminded = useCallback(
    (reminded: boolean) => setEvent((e) => (e ? { ...e, reminded } : e)),
    [],
  )

  return useMemo(
    () => ({ event, live, msLeft, refresh, setReminded }),
    [event, live, msLeft, refresh, setReminded],
  )
}
