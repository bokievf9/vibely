'use client'

import { useEffect, useState } from 'react'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import { EventLobbyBanner } from '@/features/events/components/event-lobby'
import type { CurrentEvent } from '@/features/events/types'
import { getBlindSession, leaveBlind, pingBlind } from '../actions'
import type { BlindSession } from '../types'
import { AliasAvatar } from './alias-avatar'
import { useOwnBlindSignals } from './use-blind-channel'
import { SearchingNow } from './searching-now'

const PING_MS = 20_000
const POLL_MS = 8_000
const TIMEOUT_MS = 30_000

type Props = {
  userId: string
  // The live Blind Dating Night this search belongs to (lobby mode), or null.
  event: CurrentEvent | null
  onPaired: (s: BlindSession) => void
  onCancel: () => void
}

// Keeps the user "present" in the queue and waits for a partner: a broadcast signal,
// with polling as a fallback if the socket drops. After 30 seconds it suggests widening the
// preferences; the user stays in the queue until they leave. In a night the preferences are
// already relaxed, so the timeout only offers to keep waiting or to leave.
export function WaitingRoom({ userId, event, onPaired, onCancel }: Props) {
  const { dict } = useI18n()
  const t = dict.blindDate
  const [round, setRound] = useState(0)
  const [timedOut, setTimedOut] = useState(false)

  const check = async () => {
    const session = await getBlindSession()
    if (session) onPaired(session)
  }
  useOwnBlindSignals(userId, true, { onPaired: () => void check() })

  useEffect(() => {
    const ping = setInterval(() => void pingBlind(), PING_MS)
    const poll = setInterval(() => void check(), POLL_MS)
    return () => {
      clearInterval(ping)
      clearInterval(poll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intervals run for the component's lifetime
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [round])

  const leave = () => {
    void leaveBlind()
    onCancel()
  }

  const keepWaiting = () => {
    setTimedOut(false)
    setRound((r) => r + 1)
    void pingBlind()
  }

  if (timedOut) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
        <SearchX className="text-muted size-14" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold" role="status">
            {t.timeoutTitle}
          </h2>
          <p className="text-muted">{event ? dict.events.waitingHint : t.timeoutHint}</p>
        </div>
        {event ? <EventLobbyBanner event={event} className="w-full" /> : <SearchingNow className="justify-center" />}
        <div className="flex w-full max-w-xs flex-col gap-2">
          {event ? (
            <>
              <Button fullWidth onClick={keepWaiting}>
                {t.keepWaiting}
              </Button>
              <Button fullWidth variant="secondary" onClick={leave}>
                {dict.events.leave}
              </Button>
            </>
          ) : (
            <>
              <Button fullWidth onClick={leave}>
                {t.widenFilters}
              </Button>
              <Button fullWidth variant="secondary" onClick={keepWaiting}>
                {t.keepWaiting}
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      {/* CSS animation: runs on the compositor, keeps going while the JS thread polls and pings. */}
      <div className="relative flex size-28 items-center justify-center" aria-hidden>
        <span className="border-accent/15 border-t-accent absolute inset-0 animate-spin rounded-full border-[3px] [animation-duration:1.4s]" />
        <AliasAvatar alias={((round * 97 + 311) % 900) + 100} size={76} className="blur-[1px]" />
        <span className="text-foreground/90 absolute text-2xl font-bold">?</span>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold" role="status">
          {t.searching}
        </h2>
        <p className="text-muted text-pretty">{event ? dict.events.waitingHint : t.searchingHint}</p>
      </div>
      {event ? (
        <EventLobbyBanner event={event} className="w-full" />
      ) : (
        <SearchingNow className="justify-center" />
      )}
      <Button variant="secondary" onClick={leave}>
        {event ? dict.events.leave : t.cancel}
      </Button>
    </div>
  )
}
