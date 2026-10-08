'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import type { Tag } from '@/features/profile/queries'
import {
  endRandom,
  getRandomSession,
  joinRandom,
  loadRandomMessages,
  revealRandom,
} from '../actions'
import type { JoinFilters } from '../schemas'
import type { RandomMessage, RandomSession } from '../types'
import { AnonChat } from './anon-chat'
import { RandomFilters } from './random-filters'
import { SessionBar } from './session-bar'
import { useRandomChannel } from './use-random-channel'
import { WaitingRoom } from './waiting-room'
import { Immersive } from '@/components/layout/immersive'

type Stage = 'filters' | 'waiting' | 'chat' | 'ended'
type Props = {
  userId: string
  tags: Tag[]
  defaults: JoinFilters
  initialSession: RandomSession | null
  initialMessages: RandomMessage[]
}

const TYPING_VISIBLE_MS = 4_000
const EASE_OUT = [0.23, 1, 0.32, 1] as const

export function RandomChat({ userId, tags, defaults, initialSession, initialMessages }: Props) {
  const errorText = useErrorText()
  const [stage, setStage] = useState<Stage>(initialSession ? 'chat' : 'filters')
  const [filters, setFilters] = useState(defaults)
  const [session, setSession] = useState(initialSession)
  const [messages, setMessages] = useState(initialMessages)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const add = (m: RandomMessage) =>
    setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))
  const refresh = async () => setSession(await getRandomSession())

  const enterChat = async (s: RandomSession) => {
    setSession(s)
    setMessages(await loadRandomMessages(s.id))
    setStage('chat')
  }

  const { sendTyping } = useRandomChannel(stage === 'chat' ? (session?.id ?? null) : null, {
    onMessage: (m) => {
      if (!session) return
      add({ id: m.id, body: m.body, mine: m.from === session.mySide, createdAt: m.created_at })
      if (m.from !== session.mySide) setPartnerTyping(false)
    },
    onTyping: (from) => {
      if (from === session?.mySide) return
      setPartnerTyping(true)
      clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setPartnerTyping(false), TYPING_VISIBLE_MS)
    },
    onRevealRequested: (from) => {
      if (from !== session?.mySide) setSession((s) => s && { ...s, partnerRevealed: true })
    },
    onRevealed: () => void refresh(),
    // Only an open chat can end; a late signal must not interrupt the next search.
    onEnded: () => setStage((s) => (s === 'chat' ? 'ended' : s)),
  })

  useEffect(() => () => clearTimeout(typingTimer.current), [])

  const join = async (f: JoinFilters) => {
    setFilters(f)
    const result = await joinRandom(f)
    if (!result.ok) {
      setStage('filters')
      return setError(result.error)
    }
    setError(undefined)
    if (result.data) await enterChat(result.data)
    else setStage('waiting')
  }

  const start = (f: JoinFilters) => startTransition(() => join(f))

  const reveal = () =>
    startTransition(async () => {
      if (!session) return
      const result = await revealRandom(session.id)
      if (result.ok && result.data) setSession(result.data)
    })

  const end = async () => {
    if (session) await endRandom(session.id)
    setStage('ended')
  }

  const reset = () => {
    setSession(null)
    setMessages([])
    setPartnerTyping(false)
  }

  const restart = () => {
    reset()
    setStage('filters')
  }

  // Ends the current chat (if still active) and re-joins right away with the same filters.
  const next = () =>
    startTransition(async () => {
      if (stage === 'chat' && session) await endRandom(session.id)
      reset()
      setStage('waiting')
      await join(filters)
    })

  // ended shares the chat's key: the conversation stays put and only its bottom slot changes.
  const view = stage === 'ended' ? 'chat' : stage

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        className="flex flex-1 flex-col"
        // Opacity only: a leftover transform would become the containing block of the fixed
        // dialogs inside (end, skip, report) and pin them to this box instead of the screen.
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
      >
        {view === 'filters' && (
          <RandomFilters
            tags={tags}
            initial={filters}
            pending={pending}
            error={errorText(error)}
            onStart={start}
          />
        )}
        {view === 'waiting' && (
          <WaitingRoom
            userId={userId}
            onPaired={(s) => void enterChat(s)}
            onCancel={() => setStage('filters')}
          />
        )}
        {view === 'chat' && (
          // Immersive while chatting: no tab bar, the composer sits on the bottom edge.
          <div
            className="flex flex-1 flex-col gap-3"
            data-immersive={stage === 'chat' || undefined}
          >
            <Immersive active={stage === 'chat'} />
            {session && (
              <SessionBar
                session={session}
                active={stage === 'chat'}
                pending={pending}
                onReveal={reveal}
                onEnd={end}
                onNext={next}
              />
            )}
            {session && (
              <AnonChat
                sessionId={session.id}
                messages={messages}
                partnerTyping={partnerTyping}
                disabled={stage !== 'chat'}
                footer={
                  stage === 'ended' ? (
                    <EndedCard pending={pending} onNext={next} onRestart={restart} />
                  ) : undefined
                }
                onSent={add}
                onTyping={() => sendTyping(session.mySide)}
              />
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

// Takes the composer's place at the bottom, above the tab bar that comes back once the chat ends.
function EndedCard({
  pending,
  onNext,
  onRestart,
}: {
  pending: boolean
  onNext: () => void
  onRestart: () => void
}) {
  const { dict } = useI18n()
  const reduce = useReducedMotion()
  return (
    <motion.div
      role="status"
      className="bg-background/95 sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 px-4 pt-2 pb-3 backdrop-blur"
      initial={{ opacity: 0, transform: reduce ? 'translateY(0px)' : 'translateY(16px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      <div className="bg-surface border-border flex flex-col items-center gap-3 rounded-3xl border p-4 text-center">
        <p className="font-medium">{dict.random.ended}</p>
        <div className="grid w-full grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <Button loading={pending} onClick={onNext}>
            {dict.random.next}
          </Button>
          <Button variant="secondary" onClick={onRestart}>
            {dict.random.changeFilters}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
