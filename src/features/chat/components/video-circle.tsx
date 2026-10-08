'use client'

import { useEffect, useRef } from 'react'
import { VolumeX } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { formatDuration } from '../media'
import type { ChatVideo } from '../types'

type Props = { video: ChatVideo; onError: () => void }

const SIZE_PX = 208

// Video circle in the chat: muted, looping and playing only while on screen. Tapping the bubble
// opens it full screen with sound (handled by the bubble's tap gesture).
export function VideoCircle({ video, onError }: Props) {
  const { dict } = useI18n()
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !video.url) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void el.play().catch(() => undefined)
        else el.pause()
      },
      { threshold: 0.6 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [video.url])

  return (
    <span
      className="bg-background/30 relative block overflow-hidden rounded-full"
      style={{ width: SIZE_PX, height: SIZE_PX }}
    >
      {video.url && (
        <video
          ref={ref}
          src={video.url}
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          aria-label={dict.media.watch}
          onError={onError}
          className="pointer-events-none size-full object-cover"
        />
      )}
      <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white tabular-nums">
        <VolumeX className="size-3" aria-hidden /> {formatDuration(video.durationMs)}
      </span>
    </span>
  )
}
