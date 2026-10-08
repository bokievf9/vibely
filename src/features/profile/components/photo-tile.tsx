'use client'

import type { PointerEvent } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, GripVertical, Star, X } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { OwnPhoto } from '../queries'
import type { PhotoDrag } from './use-photo-drag'

type HandleProps = {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
  onPointerMove: (e: PointerEvent<HTMLElement>) => void
  onPointerUp: () => void
  onPointerCancel: () => void
}

type Props = {
  photo: OwnPhoto
  index: number
  count: number
  pending: boolean
  drag: PhotoDrag | null
  handle: HandleProps
  onMove: (to: number) => void
  onRemove: () => void
}

const ctl = 'flex size-7 items-center justify-center rounded-full bg-black/60 text-white'

// One photo in the manager: drag handle, delete, and "Make main" / ← → for button-only reordering.
export function PhotoTile({ photo, index, count, pending, drag, handle, onMove, onRemove }: Props) {
  const { dict } = useI18n()
  const t = dict.avatar
  const dragging = drag?.from === index
  const target = drag !== null && !dragging && drag.over === index

  return (
    <li
      data-photo-index={index}
      className={cn(
        'bg-surface relative aspect-[3/4] overflow-hidden rounded-2xl transition-shadow',
        dragging && 'z-10 opacity-90 shadow-2xl',
        target && 'ring-accent ring-2',
        index === 0 && !drag && 'ring-accent/60 ring-2',
      )}
      style={dragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.05)` } : {}}
    >
      <Image
        src={photo.url}
        alt={fmt(dict.onboarding.photoAlt, { n: index + 1 })}
        width={photo.width}
        height={photo.height}
        sizes="33vw"
        draggable={false}
        className="size-full object-cover select-none"
      />
      <button
        type="button"
        {...handle}
        disabled={pending || count < 2}
        aria-label={t.reorderHint}
        className={cn(ctl, 'absolute top-1.5 left-1.5 touch-none disabled:hidden')}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={pending}
        aria-label={dict.onboarding.deletePhoto}
        className={cn(ctl, 'absolute top-1.5 right-1.5')}
      >
        <X className="size-4" />
      </button>
      <div className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1">
        {index === 0 ? (
          <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold">
            {t.main}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onMove(index - 1)}
              disabled={pending}
              aria-label={t.moveLeft}
              className={ctl}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onMove(0)}
              disabled={pending}
              aria-label={t.makeMain}
              title={t.makeMain}
              className={ctl}
            >
              <Star className="size-4" />
            </button>
          </>
        )}
        {index < count - 1 && (
          <button
            type="button"
            onClick={() => onMove(index + 1)}
            disabled={pending}
            aria-label={t.moveRight}
            className={cn(ctl, 'ml-auto')}
          >
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>
    </li>
  )
}
