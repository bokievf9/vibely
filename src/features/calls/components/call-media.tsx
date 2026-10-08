'use client'

import { useEffect, useRef } from 'react'
import type { Track } from 'livekit-client'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

// "● Recording": shown during every call, from the first ring to hang-up (safety protocol).
export function RecordingBadge({ className }: { className?: string }) {
  const { dict } = useI18n()
  return (
    <span
      role="status"
      title={dict.calls.recordingHint}
      aria-label={dict.calls.recordingHint}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur',
        className,
      )}
    >
      <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden />
      {dict.calls.recording}
    </span>
  )
}

// A LiveKit video track rendered into a <video>; playsInline keeps iOS from going full screen.
export function TrackVideo({
  track,
  mirror = false,
  className,
}: {
  track: Track
  mirror?: boolean
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    track.attach(el)
    return () => {
      track.detach(el)
    }
  }, [track])
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn('bg-black object-cover', mirror && '-scale-x-100', className)}
    />
  )
}
