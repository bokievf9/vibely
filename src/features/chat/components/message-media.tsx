'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { ChatImage, ChatMessage } from '../types'
import { VideoCircle } from './video-circle'
import { VoicePlayer } from './voice-player'

const IMAGE_MAX_PX = 240
const IMAGE_MIN_H_PX = 96
const IMAGE_MAX_H_PX = 320

type Props = { message: ChatMessage; mine: boolean; onError: () => void }

// The media part of a bubble: photo, voice player, video circle or the "expired" placeholder of
// a file purged after 90 days (retention).
export function MessageMedia({ message: m, mine, onError }: Props) {
  const { dict } = useI18n()
  if (m.expiredMedia) {
    return (
      <span className="flex flex-col py-0.5">
        <span className="flex items-center gap-1.5 italic opacity-80">
          <Clock className="size-4" aria-hidden /> {dict.media.expired[m.expiredMedia]}
        </span>
        <span className="text-xs opacity-60">{dict.media.expiredHint}</span>
      </span>
    )
  }
  switch (m.media?.kind) {
    case 'image':
      return <Photo image={m.media} alt={dict.chats.photo} onError={onError} />
    case 'voice':
      return <VoicePlayer voice={m.media} mine={mine} onError={onError} />
    case 'video':
      return <VideoCircle video={m.media} onError={onError} />
    default:
      return null
  }
}

// Shown at most 240px wide and between 96px and 320px tall (a panorama or a long screenshot is
// cropped, never a sliver or a wall), with the box reserved before the file loads. The image fades
// in once decoded instead of popping in line by line.
function photoBox(image: ChatImage) {
  const width = Math.min(IMAGE_MAX_PX, image.width)
  const height = Math.min(
    IMAGE_MAX_H_PX,
    Math.max(IMAGE_MIN_H_PX, (width * image.height) / image.width),
  )
  return { width, height }
}

function Photo({ image, alt, onError }: { image: ChatImage; alt: string; onError: () => void }) {
  const [loaded, setLoaded] = useState<string | null>(null)
  return (
    <span
      data-media
      className="bg-background/30 block overflow-hidden rounded-xl"
      style={photoBox(image)}
    >
      {image.url && (
        // eslint-disable-next-line @next/next/no-img-element -- private signed URL, never via the optimizer
        <img
          // Cached images can finish before hydration attaches onLoad.
          ref={(el) => {
            if (el?.complete && el.naturalWidth) setLoaded(image.url)
          }}
          src={image.url}
          alt={alt}
          width={image.width}
          height={image.height}
          draggable={false}
          onLoad={() => setLoaded(image.url)}
          onError={onError}
          className={cn(
            'size-full object-cover transition-opacity duration-300 ease-out',
            loaded === image.url ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </span>
  )
}
