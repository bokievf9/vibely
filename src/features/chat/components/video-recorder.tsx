'use client'

import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { VIDEO_MAX_MS, formatDuration } from '../media'
import { useRecorder, type Recording } from './use-recorder'

type Props = {
  onClose: () => void
  onDone: (recording: Recording | null) => void
  onError: (error: ErrorKey) => void
}

const RING_R = 48
const EASE_OUT = [0.23, 1, 0.32, 1] as const
const RING_C = 2 * Math.PI * RING_R

// Full-screen video circle recorder: front camera preview in a circle, tap to start, tap again to
// stop and send (also at 60 s). Mounted only while open, so the camera is on only meanwhile.
export function VideoRecorder({ onClose, onDone, onError }: Props) {
  const { dict } = useI18n()
  const reduce = useReducedMotion()
  const done = (r: Recording | null) => {
    onDone(r)
    onClose()
  }
  const rec = useRecorder('video', done)
  const preview = useRef<HTMLVideoElement>(null)
  const recording = rec.phase === 'recording'
  const progress = Math.min(1, rec.elapsedMs / VIDEO_MAX_MS)
  const close = () => {
    rec.cancel()
    onClose()
  }

  useEffect(() => {
    let cancelled = false
    void rec.prepare().then((error) => {
      if (cancelled || !error) return
      onError(error)
      onClose()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open the camera once per mount
  }, [])

  useEffect(() => {
    const el = preview.current
    if (el && el.srcObject !== rec.stream) el.srcObject = rec.stream
  }, [rec.stream])

  const toggle = () => {
    if (recording) return void rec.stop().then(done)
    const error = rec.record()
    if (error) {
      onError(error)
      close()
    }
  }

  return (
    // Mounted inside <AnimatePresence> (chat composer): fades in, the circle grows from just
    // below its size; it leaves faster than it came.
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={dict.media.recordVideo}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.22, ease: EASE_OUT } }}
      exit={{ opacity: 0, transition: { duration: 0.16, ease: EASE_OUT } }}
      className="fixed inset-0 z-50 flex touch-none flex-col items-center justify-center gap-6 bg-neutral-950/95 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-neutral-50"
    >
      <button
        type="button"
        onClick={close}
        aria-label={dict.media.cancel}
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 flex size-11 items-center justify-center rounded-full bg-neutral-50/15 transition-transform duration-150 ease-out active:scale-90"
      >
        <X className="size-6" />
      </button>
      <motion.div
        className="relative aspect-square w-[min(80vw,20rem)]"
        initial={{ transform: reduce ? 'scale(1)' : 'scale(0.9)' }}
        animate={{ transform: 'scale(1)', transition: { duration: 0.3, ease: EASE_OUT } }}
        exit={{ transform: reduce ? 'scale(1)' : 'scale(0.94)', transition: { duration: 0.16 } }}
      >
        <video
          ref={preview}
          autoPlay
          muted
          playsInline
          className="size-full -scale-x-100 rounded-full bg-neutral-50/5 object-cover"
        />
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r={RING_R}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - progress)}
            className="text-accent transition-[stroke-dashoffset] duration-100 ease-linear"
          />
        </svg>
      </motion.div>
      <p className="text-sm tabular-nums" role="status">
        {recording ? `${formatDuration(rec.elapsedMs)} / ${formatDuration(VIDEO_MAX_MS)}` : ' '}
      </p>
      <button
        type="button"
        onClick={toggle}
        disabled={rec.phase === 'idle'}
        aria-label={recording ? dict.media.stop : dict.media.start}
        className="flex size-18 items-center justify-center rounded-full border-4 border-neutral-50 transition-transform duration-150 ease-out active:scale-95 disabled:opacity-40"
      >
        <span
          className={cn(
            'size-14 bg-red-500 transition-[border-radius,transform,scale] duration-200 ease-out',
            recording ? 'scale-50 rounded-xl' : 'rounded-full',
          )}
        />
      </button>
      <p className="max-w-xs text-center text-xs text-neutral-50/60">{dict.media.safetyNote}</p>
    </motion.div>
  )
}
