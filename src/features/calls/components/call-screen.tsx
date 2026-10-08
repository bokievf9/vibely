'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { UserRound, Volume2 } from 'lucide-react'
import { useErrorText, useI18n } from '@/i18n/client'
import { formatCallDuration } from '../timeline'
import type { CallSession } from '../types'
import { CallControls } from './call-controls'
import { RecordingBadge, TrackVideo } from './call-media'
import { useLiveKitCall } from './use-livekit-call'

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={session.peer.name}
      className="fixed inset-0 z-[60] flex flex-col bg-neutral-950 text-white"
    >
      {showRemoteVideo && call.remoteVideo && (
        <TrackVideo track={call.remoteVideo} className="absolute inset-0 size-full" />
      )}

      <header className="relative flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <RecordingBadge className="self-start" />
        {showRemoteVideo ? (
          <p className="rounded-full bg-black/40 px-3 py-1 text-sm backdrop-blur">
            {session.peer.name} · <span className="tabular-nums">{status}</span>
          </p>
        ) : null}
      </header>

      {!showRemoteVideo && (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <span className="relative size-32 overflow-hidden rounded-full bg-white/10">
            {session.peer.photoUrl ? (
              <Image
                src={session.peer.photoUrl}
                alt=""
                fill
                sizes="128px"
                className="object-cover"
              />
            ) : (
              <UserRound className="m-auto size-full p-8 text-white/60" aria-hidden />
            )}
          </span>
          <h2 className="text-2xl font-semibold">{session.peer.name}</h2>
          <p className="text-white/70 tabular-nums" aria-live="polite">
            {status}
          </p>
        </div>
      )}
      {showRemoteVideo && <div className="flex-1" />}

      {session.kind === 'video' && call.localVideo && call.cam && (
        <TrackVideo
          track={call.localVideo}
          mirror={call.facing === 'user'}
          className="absolute top-[calc(env(safe-area-inset-top)+3.5rem)] right-4 aspect-[3/4] w-28 rounded-2xl shadow-lg"
        />
      )}

      <footer className="relative flex flex-col items-center gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {call.error && (
          <p role="alert" className="rounded-xl bg-black/60 px-3 py-2 text-center text-sm">
            {errorText(call.error)}
          </p>
        )}
        {call.needsAudio && (
          <button
            type="button"
            onClick={call.unlockAudio}
            className="bg-accent flex items-center gap-2 rounded-full px-5 py-3 font-semibold"
          >
            <Volume2 className="size-5" /> {dict.calls.enableSound}
          </button>
        )}
        <CallControls call={call} kind={session.kind} onHangUp={onHangUp} />
      </footer>
    </div>
  )
}
