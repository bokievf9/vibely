'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { answerCall, endCall, getRingingCall, startCall } from '../actions'
import { RING_TIMEOUT_MS, type CallEvent, type CallSession, type IncomingCall } from '../types'
import { CallScreen } from './call-screen'
import { onCallRequest, signalCallHistory, signalCallPermission } from './call-signal'
import { IncomingCallSheet } from './incoming-call-sheet'
import { useCallChannel } from './use-call-channel'

const NOTICE_MS = 3000

// Global call state, mounted once for signed-in, verified users: incoming ring, outgoing call,
// full-screen call. Signalling arrives on the private call:<user id> Realtime topic.
export function CallLayer({ viewerId }: { viewerId: string }) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const reduce = useReducedMotion()
  const [incoming, setIncoming] = useState<IncomingCall | null>(null)
  const [session, setSession] = useState<CallSession | null>(null)
  const [answered, setAnswered] = useState(false)
  const [notice, setNotice] = useState<{ text: string; id: number } | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(noticeTimer.current), [])
  const [pending, startTransition] = useTransition()
  const busy = useRef(false)
  useEffect(() => {
    busy.current = !!session || pending
  })

  // One notice at a time: a new one replaces the old and restarts the timer.
  const flash = useCallback((text: string) => {
    clearTimeout(noticeTimer.current)
    setNotice({ text, id: Date.now() })
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS)
  }, [])
  const showError = useCallback((e: ErrorKey) => flash(errorText(e) ?? ''), [flash, errorText])

  const refreshIncoming = useCallback(async () => {
    if (busy.current) return
    setIncoming(await getRingingCall())
  }, [])

  const close = useCallback(
    (s: CallSession | null) => {
      setSession(null)
      setAnswered(false)
      if (s) {
        signalCallHistory(s.matchId)
        flash(dict.calls.ended)
      }
    },
    [dict.calls.ended, flash],
  )

  const markAnswered = useCallback(() => setAnswered(true), [])

  const hangUp = useCallback(() => {
    const s = session
    close(s)
    if (s) void endCall(s.callId)
  }, [session, close])

  const onEvent = (e: CallEvent) => {
    if (e.type === 'permission') return signalCallPermission(e.matchId)
    if (e.type === 'incoming') return void refreshIncoming()
    if (e.type === 'answered' && session?.callId === e.callId) return setAnswered(true)
    if (e.type === 'ended') {
      if (incoming?.callId === e.callId) {
        setIncoming(null)
        signalCallHistory(incoming.matchId)
      }
      if (session?.callId === e.callId) close(session)
    }
  }
  useCallChannel(viewerId, { onEvent, onReady: () => void refreshIncoming() })

  // Opened from a push notification or back from the background: is somebody ringing?
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void refreshIncoming()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshIncoming])

  useEffect(
    () =>
      onCallRequest(({ matchId, kind }) => {
        if (busy.current) return
        startTransition(async () => {
          const result = await startCall({ matchId, kind })
          if (!result.ok) return showError(result.error)
          setAnswered(false)
          setSession(result.data)
        })
      }),
    [showError],
  )

  // Nobody picked up in 30 s: hang up (recorded as missed for the callee).
  useEffect(() => {
    if (!session || answered) return
    const id = setTimeout(hangUp, RING_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [session, answered, hangUp])

  // The incoming sheet disappears when the ring times out, even without an "ended" event.
  useEffect(() => {
    if (!incoming) return
    const left = Date.parse(incoming.startedAt) + RING_TIMEOUT_MS - Date.now()
    const id = setTimeout(() => setIncoming(null), Math.max(0, left))
    return () => clearTimeout(id)
  }, [incoming])

  const accept = () => {
    const call = incoming
    if (!call) return
    startTransition(async () => {
      const result = await answerCall(call.callId)
      setIncoming(null)
      if (!result.ok) return showError(result.error)
      setAnswered(true)
      setSession(result.data)
    })
  }
  const decline = () => {
    const call = incoming
    setIncoming(null)
    if (!call) return
    startTransition(async () => {
      await endCall(call.callId)
      signalCallHistory(call.matchId)
    })
  }

  return (
    <>
      <AnimatePresence>
        {incoming && !session && (
          <IncomingCallSheet
            key={incoming.callId}
            call={incoming}
            pending={pending}
            onAccept={accept}
            onDecline={decline}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {session && (
          <CallScreen
            key={session.callId}
            session={session}
            answered={answered}
            onAnswered={markAnswered}
            onHangUp={hangUp}
            onLost={hangUp}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {notice && (
          <motion.p
            key={notice.id}
            role="status"
            initial={{ opacity: 0, transform: `translateY(${reduce ? 0 : -8}px)` }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{
              opacity: 0,
              transform: `translateY(${reduce ? 0 : -8}px)`,
              transition: { duration: 0.15 },
            }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[70] mx-auto w-fit max-w-[90vw] rounded-full bg-neutral-800 px-4 py-2 text-center text-sm text-neutral-50 shadow-lg"
          >
            {notice.text}
          </motion.p>
        )}
      </AnimatePresence>
    </>
  )
}
