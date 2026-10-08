'use client'

import { Clock } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import type { ChatImage, ChatMessage } from '../types'
import { VideoCircle } from './video-circle'
import { VoicePlayer } from './voice-player'

const IMAGE_MAX_PX = 240

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

function Photo({ image, alt, onError }: { image: ChatImage; alt: string; onError: () => void }) {
  return (
    <span
      className="bg-background/30 block overflow-hidden rounded-xl"
      style={{
        width: Math.min(IMAGE_MAX_PX, image.width),
        aspectRatio: `${image.width} / ${image.height}`,
      }}
    >
      {image.url && (
        // eslint-disable-next-line @next/next/no-img-element -- private signed URL, never via the optimizer
        <img
          src={image.url}
          alt={alt}
          width={image.width}
          height={image.height}
          draggable={false}
          onError={onError}
          className="size-full object-cover"
        />
      )}
    </span>
  )
}
