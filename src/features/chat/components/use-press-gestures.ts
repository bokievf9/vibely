'use client'

import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react'

const LONG_PRESS_MS = 450
const MOVE_TOLERANCE_PX = 8
const DOUBLE_TAP_MS = 280

type Options = {
  onLongPress: () => void
  onDoubleTap: () => void
  // Delayed until a second tap can be ruled out, so a double tap never triggers it.
  onTap?: () => void
}

// Long press (touch) / right click (desktop) → menu, double tap → ❤️, single tap → onTap.
export function usePressGestures({ onLongPress, onDoubleTap, onTap }: Options) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const lastTap = useRef(0)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      clearTimeout(tapTimer.current)
    },
    [],
  )

  const cancel = () => {
    clearTimeout(timer.current)
    start.current = null
  }

  const longPress = () => {
    if (fired.current) return
    fired.current = true
    navigator.vibrate?.(10)
    onLongPress()
  }

  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      clearTimeout(timer.current)
      timer.current = setTimeout(longPress, LONG_PRESS_MS)
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_TOLERANCE_PX) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      cancel()
      longPress()
    },
    onClick: () => {
      if (fired.current) {
        fired.current = false
        return
      }
      const now = Date.now()
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0
        clearTimeout(tapTimer.current)
        onDoubleTap()
        return
      }
      lastTap.current = now
      if (onTap) tapTimer.current = setTimeout(onTap, DOUBLE_TAP_MS)
    },
  }
}
