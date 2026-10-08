'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Phone, PhoneOff, UserRound, Video } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import type { IncomingCall } from '../types'
import { RecordingBadge } from './call-media'

type Props = { call: IncomingCall; pending: boolean; onAccept: () => void; onDecline: () => void }

// Vibrates in a ring pattern while shown (Android; iOS ignores navigator.vibrate).
function useRingVibration() {
  useEffect(() => {
    if (!('vibrate' in navigator)) return
    const ring = () => navigator.vibrate([400, 200, 400])
    ring()
    const id = setInterval(ring, 2000)
    return () => {
      clearInterval(id)
      navigator.vibrate(0)
    }
  }, [])
}

export function IncomingCallSheet({ call, pending, onAccept, onDecline }: Props) {
  const { dict } = useI18n()
  useRingVibration()
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <motion.div
        role="alertdialog"
        aria-label={call.kind === 'video' ? dict.calls.incomingVideo : dict.calls.incoming}
        initial={{ y: -120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex w-full max-w-md flex-col gap-3 rounded-3xl bg-neutral-900 p-4 text-white shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-white/10">
            {call.peer.photoUrl ? (
              <Image src={call.peer.photoUrl} alt="" fill sizes="48px" className="object-cover" />
            ) : (
              <UserRound className="m-auto size-full p-3 text-white/60" aria-hidden />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">{call.peer.name}</span>
            <span className="text-sm text-white/70">
              {call.kind === 'video' ? dict.calls.incomingVideo : dict.calls.incoming}
            </span>
          </div>
          <RecordingBadge />
        </div>
        <p className="text-xs text-white/60">{dict.calls.noticeText}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDecline}
            disabled={pending}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-red-600 font-semibold disabled:opacity-50"
          >
            <PhoneOff className="size-5" /> {dict.calls.decline}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={pending}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-green-600 font-semibold disabled:opacity-50"
          >
            {call.kind === 'video' ? <Video className="size-5" /> : <Phone className="size-5" />}
            {dict.calls.accept}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
