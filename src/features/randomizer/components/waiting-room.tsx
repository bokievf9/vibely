'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import { getRandomSession, leaveRandom, pingRandom } from '../actions'
import type { RandomSession } from '../types'
import { usePairedSignal } from './use-random-channel'

const PING_MS = 20_000
const POLL_MS = 8_000

type Props = { userId: string; onPaired: (s: RandomSession) => void; onCancel: () => void }

// Keeps the user "present" in the queue and waits for a partner: a broadcast signal,
// with polling as a fallback if the socket drops.
export function WaitingRoom({ userId, onPaired, onCancel }: Props) {
  const { dict } = useI18n()

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

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
      >
        <Shuffle className="text-accent size-16" aria-hidden />
      </motion.div>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold" role="status">
          {dict.random.searching}
        </h2>
        <p className="text-muted">{dict.random.searchingHint}</p>
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          void leaveRandom()
          onCancel()
        }}
      >
        {dict.random.cancel}
      </Button>
    </div>
  )
}
