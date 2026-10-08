'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import type { ChatImage, ChatVideo } from '../types'

export type ViewerMedia = ChatImage | ChatVideo

type Props = { media: ViewerMedia | null; onClose: () => void }

// Full-screen photo or video circle (with sound). Tap the backdrop, the × or press Escape to
// close; swipe a photo down to dismiss.
export function MediaViewer({ media, onClose }: Props) {
  const { dict } = useI18n()
  useEffect(() => {
    if (!media) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [media, onClose])

  const label = media?.kind === 'video' ? dict.media.video : dict.chats.photo
  return (
    <AnimatePresence>
      {media?.url && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.common.close}
            className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 rounded-full bg-white/10 p-2 text-white"
          >
            <X className="size-6" />
          </button>
          {media.kind === 'video' ? (
            <video
              src={media.url}
              autoPlay
              playsInline
              disablePictureInPicture
              aria-label={dict.media.watch}
              // Tap to pause/resume (also the fallback when autoplay with sound is blocked).
              onClick={(e) => {
                e.stopPropagation()
                const v = e.currentTarget
                if (v.paused) void v.play().catch(() => undefined)
                else v.pause()
              }}
              className="aspect-square w-[min(90vw,28rem)] rounded-full object-cover"
            />
          ) : (
            <motion.img
              src={media.url}
              alt={label}
              width={media.width}
              height={media.height}
              draggable={false}
              drag="y"
              dragSnapToOrigin
              onDragEnd={(_, info) => Math.abs(info.offset.y) > 120 && onClose()}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full object-contain"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
