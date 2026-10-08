'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { useI18n } from '@/i18n/client'
import { SwipeCard } from '@/features/swipe/components/swipe-card'
import type { Candidate } from '@/features/swipe/schemas'

const noop = () => {}

// "How others see me": the viewer's own swipe card in a sheet, not draggable.
export function ProfilePreview({ candidate }: { candidate: Candidate }) {
  const { dict } = useI18n()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-surface border-border active:bg-border flex h-12 items-center justify-center gap-2 rounded-2xl border font-semibold transition-[transform,background-color] duration-150 ease-out active:scale-[0.98]"
      >
        <Eye className="size-5" /> {dict.avatar.preview}
      </button>
      <Modal open={open} onClose={close} title={dict.avatar.previewTitle}>
        <p className="text-muted -mt-2 mb-3 text-sm">{dict.avatar.previewHint}</p>
        <div className="relative mx-auto aspect-[3/4] max-h-[65dvh] w-full max-w-[calc(65dvh*3/4)]">
          <SwipeCard candidate={candidate} active draggable={false} onSwipe={noop} />
        </div>
      </Modal>
    </>
  )
}
