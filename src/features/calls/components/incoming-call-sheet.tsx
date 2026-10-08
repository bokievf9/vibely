'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { Phone, PhoneOff, UserRound, Video } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import type { IncomingCall } from '../types'
import { RecordingBadge } from './call-media'
import { ACCEPT_CLASS, DECLINE_CLASS } from './call-colors'

type Props = { call: IncomingCall; pending: boolean; onAccept: () => void; onDecline: () => void }

const DISMISS_PX = 60
const DISMISS_VELOCITY = 500 // px/s, upwards
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const

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

// Drops in from the top edge and leaves the same way. Swiping it up (a flick is enough) declines,
// like pushing a banner away; dragging down only gives a little.
export function IncomingCallSheet({ call, pending, onAccept, onDecline }: Props) {
  const { dict } = useI18n()
  const reduce = useReducedMotion()
  useRingVibration()
  const y = useMotionValue(0)
  const fade = useTransform(y, [-120, 0], [0.4, 1])
  // Reduced motion: no slide (the ring and the vibration already announce it).
  const hidden = reduce ? 'translateY(0%)' : 'translateY(-120%)'

  return (
    // Enter/exit transform on the outer layer, the drag offset on the inner one: framer ignores
    // `y` on an element whose `transform` it animates.
    <motion.div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
      initial={{ transform: hidden }}
      animate={{ transform: 'translateY(0%)' }}
      exit={{ transform: hidden, transition: { duration: 0.22, ease: EASE_DRAWER } }}
      transition={{ duration: 0.4, ease: EASE_DRAWER }}
    >
      <motion.div
        role="alertdialog"
        aria-label={call.kind === 'video' ? dict.calls.incomingVideo : dict.calls.incoming}
        drag={pending ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 1, bottom: 0.08 }}
        dragSnapToOrigin
        style={{ y, opacity: fade }}
        onDragEnd={(_, info) => {
          if (info.offset.y < -DISMISS_PX || info.velocity.y < -DISMISS_VELOCITY) onDecline()
        }}
        className="pointer-events-auto flex w-full max-w-md touch-none flex-col gap-3 rounded-3xl bg-neutral-900 p-4 text-neutral-50 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-neutral-50/10">
            {call.peer.photoUrl ? (
              <Image src={call.peer.photoUrl} alt="" fill sizes="48px" className="object-cover" />
            ) : (
              <UserRound className="m-auto size-full p-3 text-neutral-50/60" aria-hidden />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">{call.peer.name}</span>
            <span className="truncate text-sm text-neutral-50/70">
              {call.kind === 'video' ? dict.calls.incomingVideo : dict.calls.incoming}
            </span>
          </div>
          <RecordingBadge className="shrink-0" />
        </div>
        <p className="text-xs text-neutral-50/60">{dict.calls.noticeText}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDecline}
            disabled={pending}
            className={`${DECLINE_CLASS} flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl font-semibold transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50`}
          >
            <PhoneOff className="size-5 shrink-0" />
            <span className="truncate">{dict.calls.decline}</span>
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={pending}
            className={`${ACCEPT_CLASS} flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl font-semibold transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50`}
          >
            {call.kind === 'video' ? (
              <Video className="size-5 shrink-0" />
            ) : (
              <Phone className="size-5 shrink-0" />
            )}
            <span className="truncate">{dict.calls.accept}</span>
          </button>
        </div>
        {/* Grabber: the sheet can be pushed up to decline. */}
        <span aria-hidden className="mx-auto -mb-1 h-1 w-9 rounded-full bg-neutral-50/25" />
      </motion.div>
    </motion.div>
  )
}
