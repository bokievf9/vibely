'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import type { ChatImage } from '../types'

// Full-screen photo. Tap the backdrop, the × or press Escape to close; swipe down to dismiss.
export function PhotoViewer({ image, onClose }: { image: ChatImage | null; onClose: () => void }) {
  const { dict } = useI18n()
  useEffect(() => {
    if (!image) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [image, onClose])

  return (
    <AnimatePresence>
      {image?.url && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={dict.chats.photo}
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
          <motion.img
            src={image.url}
            alt={dict.chats.photo}
            width={image.width}
            height={image.height}
            draggable={false}
            drag="y"
            dragSnapToOrigin
            onDragEnd={(_, info) => Math.abs(info.offset.y) > 120 && onClose()}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full object-contain"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
