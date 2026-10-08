'use client'

import { useRef, useState, type PointerEvent } from 'react'

export type PhotoDrag = { from: number; over: number; dx: number; dy: number }

// Pointer-based drag (touch, pen and mouse) from a small handle, so scrolling over the grid still
// works. Tiles mark themselves with data-photo-index; dropping on another tile moves the photo there.
export function usePhotoDrag(onMove: (from: number, to: number) => void, disabled: boolean) {
  const [drag, setDrag] = useState<PhotoDrag | null>(null)
  const state = useRef<(PhotoDrag & { x: number; y: number }) | null>(null)

  const update = (next: (PhotoDrag & { x: number; y: number }) | null) => {
    state.current = next
    setDrag(next && { from: next.from, over: next.over, dx: next.dx, dy: next.dy })
  }

  const overIndex = (x: number, y: number, from: number): number | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      const tile = el instanceof HTMLElement ? el.closest<HTMLElement>('[data-photo-index]') : null
      const index = tile ? Number(tile.dataset.photoIndex) : NaN
      if (Number.isInteger(index) && index !== from) return index
    }
    return null
  }

  const handleProps = (index: number) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      update({ from: index, over: index, dx: 0, dy: 0, x: e.clientX, y: e.clientY })
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = state.current
      if (!s) return
      const over = overIndex(e.clientX, e.clientY, s.from) ?? s.from
      update({ ...s, over, dx: e.clientX - s.x, dy: e.clientY - s.y })
    },
    onPointerUp: () => {
      const s = state.current
      update(null)
      if (s && s.from !== s.over) onMove(s.from, s.over)
    },
    onPointerCancel: () => update(null),
  })

  return { drag, handleProps }
}
