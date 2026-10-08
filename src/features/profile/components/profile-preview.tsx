'use client'

import { useState } from 'react'
import { ChevronRight, Eye } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { groupedRowClassName } from '@/components/ui/grouped'
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
      <button type="button" onClick={() => setOpen(true)} className={groupedRowClassName}>
        <span className="icon-tile">
          <Eye className="size-[1.125rem]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{dict.avatar.preview}</span>
        <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
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
