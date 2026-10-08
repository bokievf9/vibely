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
        'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-950/70 px-3 py-1 text-xs font-semibold whitespace-nowrap text-neutral-50 ring-1 ring-red-500/40 backdrop-blur',
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
      className={cn('bg-neutral-900 object-cover', mirror && '-scale-x-100', className)}
    />
  )
}
