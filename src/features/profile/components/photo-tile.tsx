'use client'

import type { PointerEvent, ReactNode } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeftRight, GripVertical, X } from 'lucide-react'
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
  onOptions: () => void
  onRemove: () => void
}

// Reorders slide to their new slot (FLIP via framer layout) instead of teleporting.
const REORDER = { type: 'spring', bounce: 0, duration: 0.35 } as const

// One photo in the manager: drag handle, delete, and an options button (make main, move earlier /
// later) for button-only reordering. Every control is a 44px target around a small visual circle.
export function PhotoTile({
  photo,
  index,
  count,
  pending,
  drag,
  handle,
  onOptions,
  onRemove,
}: Props) {
  const { dict } = useI18n()
  const t = dict.avatar
  const reduce = useReducedMotion()
  const dragging = drag?.from === index
  const target = drag !== null && !dragging && drag.over === index

  return (
    <motion.li
      layout={!reduce && !dragging}
      transition={REORDER}
      data-photo-index={index}
      className={cn(
        'bg-surface-raised relative aspect-[3/4] overflow-hidden rounded-[1.125rem] shadow-[0_8px_20px_-12px_rgb(0_0_0/0.8)]',
        dragging && 'z-10 opacity-90 shadow-2xl shadow-black/50',
        target && 'ring-accent ring-2',
        index === 0 && !drag && 'ring-accent/60 ring-2',
      )}
      style={dragging ? { x: drag.dx, y: drag.dy, scale: 1.05 } : { x: 0, y: 0, scale: 1 }}
    >
      <Image
        src={photo.url}
        alt={fmt(dict.onboarding.photoAlt, { n: index + 1 })}
        width={photo.width}
        height={photo.height}
        sizes="(max-width: 448px) 33vw, 150px"
        draggable={false}
        className="size-full object-cover select-none"
      />
      {count > 1 && (
        <Control
          {...handle}
          disabled={pending}
          label={t.reorderHint}
          className="top-0 left-0 touch-none disabled:hidden"
        >
          <GripVertical className="size-4" />
        </Control>
      )}
      <Control
        onClick={onRemove}
        disabled={pending}
        label={dict.onboarding.deletePhoto}
        className="top-0 right-0"
      >
        <X className="size-4" />
      </Control>
      {index === 0 && (
        <span className="bg-accent-gradient text-accent-foreground pointer-events-none absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-[0_2px_8px_rgb(0_0_0/0.35)]">
          {t.main}
        </span>
      )}
      {count > 1 && (
        <Control
          onClick={onOptions}
          disabled={pending}
          label={dict.discoverui.photoOptions}
          className="right-0 bottom-0"
        >
          <ArrowLeftRight className="size-4" />
        </Control>
      )}
    </motion.li>
  )
}

type ControlProps = Partial<HandleProps> & {
  onClick?: () => void
  disabled: boolean
  label: string
  className: string
  children: ReactNode
}

function Control({ label, className, children, ...props }: ControlProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'group absolute flex size-11 items-center justify-center disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="glass-dark flex size-7 items-center justify-center rounded-full text-white transition-[transform,scale,background-color] duration-150 ease-out group-active:scale-90 group-active:bg-black/80">
        {children}
      </span>
    </button>
  )
}
