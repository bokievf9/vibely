'use client'

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { haptic } from '@/lib/haptics'

const LONG_PRESS_MS = 450
// A finger that stays this long is pressing, not starting a scroll: show the press state.
const PRESS_FEEDBACK_MS = 90
const MOVE_TOLERANCE_PX = 8
const DOUBLE_TAP_MS = 280

type Handlers = {
  onPointerDown?: (e: PointerEvent) => void
  onPointerMove?: (e: PointerEvent) => void
  onPointerUp?: () => void
  onPointerCancel?: () => void
  onPointerLeave?: () => void
  onContextMenu?: (e: MouseEvent) => void
  onClick?: () => void
}

type Options = {
  enabled?: boolean
  onLongPress: () => void
  onDoubleTap: () => void
  // Delayed until a second tap can be ruled out, so a double tap never triggers it.
  onTap?: () => void
}

// Long press (touch) / right click (desktop) → menu, double tap → ❤️, single tap → onTap.
// `pressing` is true while a finger rests on the bubble before the long press fires.
export function usePressGestures({ enabled = true, onLongPress, onDoubleTap, onTap }: Options): {
  pressing: boolean
  handlers: Handlers
} {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const lastTap = useRef(0)
  const [pressing, setPressing] = useState(false)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      clearTimeout(pressTimer.current)
      clearTimeout(tapTimer.current)
    },
    [],
  )

  const cancel = () => {
    clearTimeout(timer.current)
    clearTimeout(pressTimer.current)
    start.current = null
    setPressing(false)
  }

  const longPress = () => {
    if (fired.current) return
    fired.current = true
    setPressing(false)
    haptic('light')
    onLongPress()
  }

  if (!enabled) return { pressing: false, handlers: {} }

  return {
    pressing,
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        if (e.button !== 0) return
        fired.current = false
        start.current = { x: e.clientX, y: e.clientY }
        clearTimeout(timer.current)
        clearTimeout(pressTimer.current)
        timer.current = setTimeout(longPress, LONG_PRESS_MS)
        pressTimer.current = setTimeout(() => setPressing(true), PRESS_FEEDBACK_MS)
      },
      onPointerMove: (e: PointerEvent) => {
        const s = start.current
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_TOLERANCE_PX) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
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
    },
  }
}
