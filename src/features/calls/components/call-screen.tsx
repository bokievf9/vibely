'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { UserRound, Volume2 } from 'lucide-react'
import { useErrorText, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { formatCallDuration } from '../timeline'
import type { CallSession } from '../types'
import { CallControls } from './call-controls'
import { RecordingBadge, TrackVideo } from './call-media'
import ripple from './call-ripple.module.css'
import { SelfView } from './self-view'
import { useLiveKitCall } from './use-livekit-call'

const EASE_OUT = [0.23, 1, 0.32, 1] as const

type Props = {
  session: CallSession
  // Caller: the callee picked up (Realtime "answered"). Callee: always true.
  answered: boolean
  // The callee joined the room (only possible after answering): covers a missed "answered" event.
  onAnswered: () => void
  onHangUp: () => void
  onLost: () => void
}

// Keeps the screen on during the call where the Wake Lock API exists.
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    navigator.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {})
    return () => void lock?.release().catch(() => {})
  }, [])
}

function useElapsed(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) return
    const start = Date.now()
    const id = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [running])
  return elapsed
}

// Full-screen call: remote video (or the partner's photo for audio), own camera in a corner,
// persistent recording indicator, status/duration and controls.
export function CallScreen({ session, answered, onAnswered, onHangUp, onLost }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const reduce = useReducedMotion()
  const call = useLiveKitCall(session, onLost)
  const live = answered && call.partnerJoined
  useEffect(() => {
    if (call.partnerJoined && !answered) onAnswered()
  }, [call.partnerJoined, answered, onAnswered])
  const elapsed = useElapsed(live)
  useWakeLock()

  const status =
    call.link === 'reconnecting'
      ? dict.calls.reconnecting
      : !answered
        ? dict.calls.calling
        : !live
          ? dict.calls.connecting
          : formatCallDuration(elapsed)
  const showRemoteVideo = session.kind === 'video' && call.remoteVideo

  // Mounted inside <AnimatePresence> (call layer): rises in as one surface, leaves faster.
  const from = reduce ? 'scale(1)' : 'scale(0.97)'
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={session.peer.name}
      initial={{ opacity: 0, transform: from }}
      animate={{ opacity: 1, transform: 'scale(1)' }}
      exit={{ opacity: 0, transform: from, transition: { duration: 0.18, ease: EASE_OUT } }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
      className="fixed inset-0 z-[60] flex flex-col bg-neutral-950 text-neutral-50"
    >
      {showRemoteVideo && call.remoteVideo && (
        <TrackVideo track={call.remoteVideo} className="absolute inset-0 size-full" />
      )}

      <header className="relative z-20 flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {/* Safety protocol: visible from the first ring to hang-up, never covered (the self view
            stays below this header). */}
        <RecordingBadge className="self-start" />
        {showRemoteVideo ? (
          <p className="max-w-full truncate rounded-full bg-neutral-950/45 px-3 py-1 text-sm backdrop-blur">
            {session.peer.name} · <span className="tabular-nums">{status}</span>
          </p>
        ) : null}
      </header>

      {!showRemoteVideo && (
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6">
          <span className={cn('size-32 shrink-0 rounded-full', !live && ripple.ripple)}>
            <span className="relative block size-full overflow-hidden rounded-full bg-neutral-50/10">
              {session.peer.photoUrl ? (
                <Image
                  src={session.peer.photoUrl}
                  alt=""
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              ) : (
                <UserRound className="m-auto size-full p-8 text-neutral-50/60" aria-hidden />
              )}
            </span>
          </span>
          <h2 className="line-clamp-2 max-w-full text-center text-2xl font-semibold [overflow-wrap:anywhere]">
            {session.peer.name}
          </h2>
          <p className="text-neutral-50/70 tabular-nums" aria-live="polite">
            {status}
          </p>
        </div>
      )}
      {showRemoteVideo && <div className="flex-1" />}

      {session.kind === 'video' && call.localVideo && call.cam && (
        <SelfView track={call.localVideo} mirror={call.facing === 'user'} />
      )}

      <footer className="relative z-20 flex flex-col items-center gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {call.error && (
          <p role="alert" className="rounded-xl bg-neutral-950/60 px-3 py-2 text-center text-sm">
            {errorText(call.error)}
          </p>
        )}
        {call.needsAudio && (
          <button
            type="button"
            onClick={call.unlockAudio}
            className="bg-accent text-accent-foreground flex items-center gap-2 rounded-full px-5 py-3 font-semibold transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <Volume2 className="size-5" /> {dict.calls.enableSound}
          </button>
        )}
        <CallControls call={call} kind={session.kind} onHangUp={onHangUp} />
      </footer>
    </motion.div>
  )
}
