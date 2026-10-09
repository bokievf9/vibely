'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Immersive } from '@/components/layout/immersive'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { pseudonymColor, pseudonymEmoji, pseudonymName } from '@/features/feed/pseudonym'
import { blockBlind, decideBlind, getBlindSession } from '../actions'
import type { BlindMessage, BlindSession } from '../types'
import { needsUnlock, REVEAL_UNLOCK_MESSAGES, revealProgress } from '../unlock'
import { AliasAvatar } from './alias-avatar'
import { AnonChat } from './anon-chat'
import { ContextCard } from './context-card'
import { RevealScreen } from './reveal-screen'
import { SessionHeader } from './session-header'
import { useBlindChannel, useOwnBlindSignals } from './use-blind-channel'

type Props = { userId: string; initialSession: BlindSession; initialMessages: BlindMessage[] }

const TYPING_VISIBLE_MS = 4_000
// Safety net for a dropped socket: re-reads the session (ended? matched? counts) while it is open.
const SYNC_MS = 10_000
const EASE_OUT = [0.23, 1, 0.32, 1] as const

// A private reply (post), "Say hi" (prompt) or status reply (status) conversation on the Blind
// Dating chat UI: the post, question or status pinned on top, Connect renamed "Reveal identity"
// and locked until each side wrote REVEAL_UNLOCK_MESSAGES messages (post), names shown from the
// start (prompt, status).
export function Conversation({ userId, initialSession, initialMessages }: Props) {
  const { dict } = useI18n()
  const t = dict.blindDate
  const c = dict.conversations
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [session, setSession] = useState(initialSession)
  const [messages, setMessages] = useState(initialMessages)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const sessionId = session.id
  const isActive = session.state === 'active'
  const revealed = session.state === 'matched'

  const add = (m: BlindMessage) =>
    setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))

  const sync = async () => {
    const fresh = await getBlindSession(sessionId)
    if (fresh && fresh.id === sessionId) setSession(fresh)
  }

  const { sendTyping } = useBlindChannel(sessionId, {
    onMessage: (m) => {
      const mine = m.from === session.mySide
      add({ id: m.id, body: m.body, mine, createdAt: m.created_at })
      if (!mine) {
        setPartnerTyping(false)
        setSession((s) => ({ ...s, partnerMessages: s.partnerMessages + 1 }))
      }
    },
    onTyping: (from) => {
      if (from === session.mySide) return
      setPartnerTyping(true)
      clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setPartnerTyping(false), TYPING_VISIBLE_MS)
    },
    onMatched: () => void sync(),
    onEnded: () => {
      setPartnerTyping(false)
      setSession((s) => (s.state === 'active' ? { ...s, state: 'ended' } : s))
    },
  })

  useOwnBlindSignals(userId, isActive, {
    onDecided: (id, connect) => {
      if (id !== sessionId) return
      if (connect) setSession((s) => ({ ...s, myDecision: true }))
      else void sync()
    },
  })

  useEffect(() => {
    if (!isActive) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void sync()
    }, SYNC_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only depends on sessionId
  }, [isActive, sessionId])

  useEffect(() => () => clearTimeout(typingTimer.current), [])

  const decide = async (connect: boolean) => {
    const result = await decideBlind(sessionId, connect)
    if (!result.ok) return setError(result.error)
    setError(undefined)
    const { state } = result.data
    if (state === 'waiting') setSession((s) => ({ ...s, myDecision: true }))
    else if (state === 'matched') await sync()
    else setSession((s) => ({ ...s, state, myDecision: state === 'passed' ? false : s.myDecision }))
  }

  const block = async () => {
    const result = await blockBlind(sessionId)
    if (!result.ok) return setError(result.error)
    setBlocked(true)
    setSession((s) => ({ ...s, state: s.state === 'active' ? 'passed' : s.state }))
  }

  const identity = headerIdentity(session, dict)
  const progress = needsUnlock(session.kind)
    ? revealProgress(session.myMessages, session.partnerMessages)
    : null
  const connect =
    session.kind === 'post'
      ? {
          label: c.revealIdentity,
          waitingText: c.revealWaiting,
          lockedHint:
            progress && !progress.unlocked
              ? `${fmt(c.revealLocked, { n: REVEAL_UNLOCK_MESSAGES })} · ${fmt(c.revealLockedProgress, {
                  mine: REVEAL_UNLOCK_MESSAGES - progress.mineLeft,
                  theirs: REVEAL_UNLOCK_MESSAGES - progress.theirsLeft,
                  n: REVEAL_UNLOCK_MESSAGES,
                })}`
              : undefined,
        }
      : undefined

  return (
    <>
      <div className="flex flex-1 flex-col" data-immersive={isActive || undefined}>
        <Immersive active={isActive} />
        <SessionHeader
          session={session}
          pending={pending}
          back={{ href: '/chats', label: dict.common.back }}
          identity={identity}
          connect={connect}
          onConnect={() => startTransition(() => decide(true))}
          onPass={() => decide(false)}
          onBlock={block}
        />
        <section className="flex flex-1 flex-col px-4">
          <ContextCard context={session.context} />
          {session.kind === 'post' && isActive && (
            <p className="text-muted text-footnote px-1 pt-3 text-center text-pretty">
              {c.revealConfirmHint}
            </p>
          )}
          {error && isActive && (
            <p role="alert" className="text-danger py-2 text-center text-sm">
              {errorText(error)}
            </p>
          )}
          <AnonChat
            sessionId={sessionId}
            messages={messages}
            partnerLabel={identity.title}
            partnerTyping={partnerTyping}
            disabled={!isActive}
            notifyPartner
            footer={
              isActive || revealed ? undefined : (
                <EndedCard
                  title={blocked ? t.blocked : session.state === 'passed' ? t.passed : t.movedOn}
                  onBack={() => router.push('/chats')}
                />
              )
            }
            onSent={(m) => {
              add(m)
              setSession((s) => ({ ...s, myMessages: s.myMessages + 1 }))
            }}
            onTyping={() => sendTyping(session.mySide)}
          />
        </section>
      </div>
      {revealed && (
        <RevealScreen
          session={session}
          nextLabel={c.backToChats}
          onNext={() => router.push('/chats')}
        />
      )}
    </>
  )
}

type Dict = ReturnType<typeof useI18n>['dict']

// What the header shows: the author as the post shows them (replier side), "Partner #N" (author
// side), or the real person (prompt conversations).
function headerIdentity(session: BlindSession, dict: Dict) {
  const t = dict.blindDate
  const c = dict.conversations
  const ctx = session.context
  if (ctx?.kind === 'post' && !ctx.iAmAuthor) {
    const myAlias = fmt(t.partner, { n: session.myAlias })
    if (ctx.author) {
      const a = ctx.author
      return {
        avatar: (
          <Avatar
            photo={a.photoUrl ? { url: a.photoUrl, width: 36, height: 36 } : null}
            alt=""
            size={36}
          />
        ),
        title: a.age !== null ? `${a.name}, ${a.age}` : a.name,
        subtitle: fmt(c.replierHint, { alias: myAlias }),
      }
    }
    const p = ctx.authorPseudonym
    return {
      avatar: (
        <span
          aria-hidden
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-lg ${p ? pseudonymColor(p) : 'bg-surface-raised'}`}
        >
          {p ? pseudonymEmoji(p) : '🙂'}
        </span>
      ),
      title: p ? pseudonymName(dict.feed.pseudonym, p) : c.postAuthor,
      subtitle: fmt(c.replierHint, { alias: myAlias }),
    }
  }
  if ((ctx?.kind === 'prompt' || ctx?.kind === 'status') && session.partner) {
    const p = session.partner
    return {
      avatar: <Avatar photo={p.photo} alt="" size={36} />,
      title: `${p.name}, ${p.age}`,
      subtitle: ctx.kind === 'status' ? dict.statuses.chatHint : c.promptHint,
    }
  }
  return {
    avatar: <AliasAvatar alias={session.partnerAlias} size={36} />,
    title: fmt(t.partner, { n: session.partnerAlias }),
    subtitle: ctx?.kind === 'post' ? c.authorHint : t.anonymousHint,
  }
}

// Takes the composer's place at the bottom once the conversation ended.
function EndedCard({ title, onBack }: { title: string; onBack: () => void }) {
  const { dict } = useI18n()
  const c = dict.conversations
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
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold">{title}</p>
          <p className="text-muted text-sm text-pretty">{c.endedHint}</p>
        </div>
        <Button fullWidth variant="secondary" onClick={onBack}>
          {c.backToChats}
        </Button>
      </div>
    </motion.div>
  )
}
