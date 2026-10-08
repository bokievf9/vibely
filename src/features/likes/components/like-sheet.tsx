'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Heart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import { PhotoCarousel } from '@/features/profile/components/photo-carousel'
import { SwipeCardInfo } from '@/features/swipe/components/swipe-card-info'
import type { Candidate } from '@/features/swipe/schemas'

type Props = {
  person: Candidate
  busy: boolean
  onDecide: (direction: 'like' | 'pass') => void
  onClose: () => void
}

// Full-screen card for one person who liked the viewer: the Discover card, plus Pass / Like back.
export function LikeSheet({ person, busy, onDecide, onClose }: Props) {
  const { dict } = useI18n()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={person.name}
      className="bg-background fixed inset-0 z-50 flex justify-center"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
    >
      <div className="flex w-full max-w-md flex-col gap-4 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onClose}
          aria-label={dict.common.back}
          className="-ml-2 flex size-10 items-center justify-center"
        >
          <ChevronLeft className="size-6" />
        </button>
        <article className="bg-surface relative min-h-0 flex-1 overflow-hidden rounded-3xl shadow-xl">
          <PhotoCarousel photos={person.photos} alt={person.name} priority />
          <SwipeCardInfo candidate={person} />
        </article>
        <div className="flex items-center justify-center gap-6">
          <Button
            variant="secondary"
            size="icon"
            className="size-16 rounded-full"
            aria-label={dict.likes.pass}
            disabled={busy}
            onClick={() => onDecide('pass')}
          >
            <X className="size-8 text-red-400" />
          </Button>
          <Button
            size="icon"
            className="size-16 rounded-full"
            aria-label={dict.likes.likeBack}
            disabled={busy}
            onClick={() => onDecide('like')}
          >
            <Heart className="size-8 fill-current" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
