'use client'

import { useEffect, useState } from 'react'
import { SearchX, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import { getRandomSession, leaveRandom, pingRandom } from '../actions'
import type { RandomSession } from '../types'
import { usePairedSignal } from './use-random-channel'
import { SearchingNow } from './searching-now'

const PING_MS = 20_000
const POLL_MS = 8_000
const TIMEOUT_MS = 30_000

type Props = { userId: string; onPaired: (s: RandomSession) => void; onCancel: () => void }

// Keeps the user "present" in the queue and waits for a partner: a broadcast signal,
// with polling as a fallback if the socket drops. After 30 seconds it suggests widening filters;
// the user stays in the queue until they leave.
export function WaitingRoom({ userId, onPaired, onCancel }: Props) {
  const { dict } = useI18n()
  const [round, setRound] = useState(0)
  const [timedOut, setTimedOut] = useState(false)

  const check = async () => {
    const session = await getRandomSession()
    if (session) onPaired(session)
  }
  usePairedSignal(userId, true, () => void check())

  useEffect(() => {
    const ping = setInterval(() => void pingRandom(), PING_MS)
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
    void leaveRandom()
    onCancel()
  }

  if (timedOut) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
        <SearchX className="text-muted size-14" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold" role="status">
            {dict.random.timeoutTitle}
          </h2>
          <p className="text-muted">{dict.random.timeoutHint}</p>
        </div>
        <SearchingNow className="justify-center" />
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button fullWidth onClick={leave}>
            {dict.random.widenFilters}
          </Button>
          <Button
            fullWidth
            variant="secondary"
            onClick={() => {
              setTimedOut(false)
              setRound((r) => r + 1)
              void pingRandom()
            }}
          >
            {dict.random.keepWaiting}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      {/* CSS spin: runs on the compositor, keeps turning while the JS thread polls and pings. */}
      <div className="relative flex size-24 items-center justify-center" aria-hidden>
        <span className="border-accent/15 border-t-accent absolute inset-0 animate-spin rounded-full border-[3px] [animation-duration:1.4s]" />
        <Shuffle className="text-accent size-9" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold" role="status">
          {dict.random.searching}
        </h2>
        <p className="text-muted">{dict.random.searchingHint}</p>
      </div>
      <SearchingNow className="justify-center" />
      <Button variant="secondary" onClick={leave}>
        {dict.random.cancel}
      </Button>
    </div>
  )
}
