'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
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

type Stage = 'filters' | 'waiting' | 'chat' | 'ended'
type Props = {
  userId: string
  tags: Tag[]
  defaults: JoinFilters
  initialSession: RandomSession | null
  initialMessages: RandomMessage[]
}

const TYPING_VISIBLE_MS = 4_000

export function RandomChat({ userId, tags, defaults, initialSession, initialMessages }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [stage, setStage] = useState<Stage>(initialSession ? 'chat' : 'filters')
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
    onEnded: () => setStage('ended'),
  })

  useEffect(() => () => clearTimeout(typingTimer.current), [])

  const start = (filters: JoinFilters) =>
    startTransition(async () => {
      const result = await joinRandom(filters)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      if (result.data) await enterChat(result.data)
      else setStage('waiting')
    })

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

  const restart = () => {
    setSession(null)
    setMessages([])
    setStage('filters')
  }

  if (stage === 'filters') {
    return (
      <RandomFilters
        tags={tags}
        initial={defaults}
        pending={pending}
        error={errorText(error)}
        onStart={start}
      />
    )
  }
  if (stage === 'waiting') {
    return (
      <WaitingRoom
        userId={userId}
        onPaired={(s) => void enterChat(s)}
        onCancel={() => setStage('filters')}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      {session && (
        <SessionBar
          session={session}
          active={stage === 'chat'}
          pending={pending}
          onReveal={reveal}
          onEnd={end}
        />
      )}
      {stage === 'ended' && (
        <div className="bg-surface flex flex-col items-center gap-3 rounded-2xl p-4 text-center">
          <p>{dict.random.ended}</p>
          <Button onClick={restart}>{dict.random.next}</Button>
        </div>
      )}
      {session && (
        <AnonChat
          sessionId={session.id}
          messages={messages}
          partnerTyping={partnerTyping}
          disabled={stage !== 'chat'}
          onSent={add}
          onTyping={() => sendTyping(session.mySide)}
        />
      )}
    </div>
  )
}
