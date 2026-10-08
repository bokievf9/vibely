'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/page-header'
import { Immersive } from '@/components/layout/immersive'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import type { Tag } from '@/features/profile/queries'
import { blockBlind, decideBlind, getBlindSession, joinBlind, loadBlindMessages } from '../actions'
import type { JoinFilters } from '../schemas'
import type { BlindMessage, BlindSession } from '../types'
import { AliasAvatar } from './alias-avatar'
import { AnonChat } from './anon-chat'
import { RevealScreen } from './reveal-screen'
import { SessionHeader } from './session-header'
import { StartScreen } from './start-screen'
import { useBlindChannel, useOwnBlindSignals } from './use-blind-channel'
import { WaitingRoom } from './waiting-room'

type Stage = 'start' | 'waiting' | 'chat'
type Props = {
  userId: string
  tags: Tag[]
  defaults: JoinFilters
  initialSession: BlindSession | null
  initialMessages: BlindMessage[]
}

const TYPING_VISIBLE_MS = 4_000
// Safety net for a dropped socket: re-reads the session (ended? matched?) while it is open.
const SYNC_MS = 10_000
const EASE_OUT = [0.23, 1, 0.32, 1] as const

export function BlindDate({ userId, tags, defaults, initialSession, initialMessages }: Props) {
  const { dict } = useI18n()
  const t = dict.blindDate
  const errorText = useErrorText()
  const [stage, setStage] = useState<Stage>(initialSession ? 'chat' : 'start')
  const [filters, setFilters] = useState(defaults)
  const [session, setSession] = useState(initialSession)
  const [messages, setMessages] = useState(initialMessages)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const sessionId = session?.id ?? null
  const isActive = stage === 'chat' && session?.state === 'active'
  const revealed = stage === 'chat' && session?.state === 'matched'

  const add = (m: BlindMessage) =>
    setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))

  // Re-reads this session from the server (state, my decision, and the profile after a match).
  const sync = async (id: string) => {
    const fresh = await getBlindSession(id)
    if (fresh && fresh.id === id) setSession((s) => (s?.id === id ? fresh : s))
  }

  const enterChat = async (s: BlindSession) => {
    setSession(s)
    setBlocked(false)
    setMessages(await loadBlindMessages(s.id))
    setStage('chat')
  }

  const { sendTyping } = useBlindChannel(stage === 'chat' ? sessionId : null, {
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
    onMatched: () => {
      if (sessionId) void sync(sessionId)
    },
    // Only an open chat can end; my own Pass already set 'passed'.
    onEnded: () => {
      setPartnerTyping(false)
      setSession((s) => (s && s.state === 'active' ? { ...s, state: 'ended' } : s))
    },
  })

  // My Connect / Pass from another tab or device.
  useOwnBlindSignals(userId, isActive, {
    onDecided: (id, connect) => {
      if (id !== sessionId) return
      if (connect) setSession((s) => s && { ...s, myDecision: true })
      else void sync(id)
    },
  })

  useEffect(() => {
    if (!isActive || !sessionId) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void sync(sessionId)
    }, SYNC_MS)
    return () => clearInterval(timer)
  }, [isActive, sessionId])

  useEffect(() => () => clearTimeout(typingTimer.current), [])

  const join = async (f: JoinFilters) => {
    setFilters(f)
    const result = await joinBlind(f)
    if (!result.ok) {
      setStage('start')
      return setError(result.error)
    }
    setError(undefined)
    if (result.data) await enterChat(result.data)
    else setStage('waiting')
  }

  const start = (f: JoinFilters) => startTransition(() => join(f))

  const decide = async (connect: boolean) => {
    if (!session) return
    const result = await decideBlind(session.id, connect)
    if (!result.ok) return setError(result.error)
    setError(undefined)
    const { state } = result.data
    if (state === 'waiting') setSession((s) => s && { ...s, myDecision: true })
    else if (state === 'matched') await sync(session.id)
    else
      setSession((s) => s && { ...s, state, myDecision: state === 'passed' ? false : s.myDecision })
  }

  const connect = () => startTransition(() => decide(true))
  const pass = () => decide(false)

  const block = async () => {
    if (!session) return
    const result = await blockBlind(session.id)
    if (!result.ok) return setError(result.error)
    setBlocked(true)
    setSession((s) => s && { ...s, state: s.state === 'active' ? 'passed' : s.state })
  }

  const reset = () => {
    setSession(null)
    setMessages([])
    setPartnerTyping(false)
    setBlocked(false)
    setError(undefined)
  }

  const restart = () => {
    reset()
    setStage('start')
  }

  // Leaves the finished date and searches again right away with the same preferences.
  const next = () =>
    startTransition(async () => {
      reset()
      setStage('waiting')
      await join(filters)
    })

  return (
    <>
      {stage !== 'chat' && <PageHeader title={t.title} />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stage}
          className="flex flex-1 flex-col"
          // Opacity only: a leftover transform would become the containing block of the fixed
          // dialogs inside (pass, block, report) and pin them to this box instead of the screen.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
        >
          {stage === 'start' && (
            <section className="flex flex-1 flex-col px-4 pt-2">
              <StartScreen
                tags={tags}
                initial={filters}
                pending={pending}
                error={errorText(error)}
                onStart={start}
              />
            </section>
          )}
          {stage === 'waiting' && (
            <section className="flex flex-1 flex-col px-4">
              <WaitingRoom
                userId={userId}
                onPaired={(s) => void enterChat(s)}
                onCancel={() => setStage('start')}
              />
            </section>
          )}
          {stage === 'chat' && session && (
            // Immersive while the date is on: no tab bar, the composer sits on the bottom edge.
            <div className="flex flex-1 flex-col" data-immersive={isActive || undefined}>
              <Immersive active={isActive} />
              <SessionHeader
                session={session}
                pending={pending}
                onConnect={connect}
                onPass={pass}
                onBlock={block}
              />
              <section className="flex flex-1 flex-col px-4">
                <ChatIntro alias={session.partnerAlias} />
                {error && isActive && (
                  <p role="alert" className="text-danger py-2 text-center text-sm">
                    {errorText(error)}
                  </p>
                )}
                <AnonChat
                  sessionId={session.id}
                  messages={messages}
                  partnerLabel={fmt(t.partner, { n: session.partnerAlias })}
                  partnerTyping={partnerTyping}
                  disabled={!isActive}
                  footer={
                    isActive || revealed ? undefined : (
                      <EndedCard
                        mine={session.state === 'passed'}
                        blocked={blocked}
                        pending={pending}
                        onNext={next}
                        onRestart={restart}
                      />
                    )
                  }
                  onSent={add}
                  onTyping={() => sendTyping(session.mySide)}
                />
              </section>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {revealed && session && <RevealScreen session={session} onNext={next} />}
    </>
  )
}

// Top of the conversation: who this is and the house rules, so an empty chat is not a blank page.
function ChatIntro({ alias }: { alias: number }) {
  const { dict } = useI18n()
  const t = dict.blindDate
  return (
    <div className="flex flex-col items-center gap-2 pt-6 pb-2 text-center">
      <AliasAvatar alias={alias} size={64} />
      <p className="font-semibold">{fmt(t.partner, { n: alias })}</p>
      <p className="text-muted max-w-xs text-sm text-pretty">{t.chatIntro}</p>
    </div>
  )
}

// Takes the composer's place at the bottom, above the tab bar that comes back once the date ends.
function EndedCard({
  mine,
  blocked,
  pending,
  onNext,
  onRestart,
}: {
  mine: boolean
  blocked: boolean
  pending: boolean
  onNext: () => void
  onRestart: () => void
}) {
  const { dict } = useI18n()
  const t = dict.blindDate
  const reduce = useReducedMotion()
  const title = blocked ? t.blocked : mine ? t.passed : t.movedOn
  const hint = mine || blocked ? t.passedHint : t.movedOnHint
  return (
    <motion.div
      role="status"
      className="bg-background/95 sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 px-4 pt-2 pb-3 backdrop-blur"
      initial={{ opacity: 0, transform: reduce ? 'translateY(0px)' : 'translateY(16px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      <div className="bg-surface border-border flex flex-col items-center gap-3 rounded-3xl border p-4 text-center">
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold">{title}</p>
          <p className="text-muted text-sm text-pretty">{hint}</p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button loading={pending} onClick={onNext}>
            {t.next}
          </Button>
          <Button variant="secondary" onClick={onRestart}>
            {t.changeFilters}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
