'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ChevronLeft, Lock, Mic, SendHorizontal, Trash2 } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { formatDuration } from '../media'
import { useRecorder, type Recording } from './use-recorder'

type Props = {
  disabled: boolean
  onActiveChange: (active: boolean) => void
  onDone: (recording: Recording | null) => void
  onError: (error: ErrorKey) => void
}

const TAP_MS = 300
const CANCEL_PX = 90
const LOCK_PX = 70

type Gesture = { x: number; y: number; at: number; holding: boolean; lockedAt: number }

// Telegram-style mic: hold to record and release to send, slide left to cancel, slide up to lock.
// A short tap (or the keyboard) starts hands-free recording right away; then tap send.
export function VoiceRecorder({ disabled, onActiveChange, onDone, onError }: Props) {
  const { dict } = useI18n()
  const [locked, setLocked] = useState(false)
  const [offsetX, setOffsetX] = useState(0)
  const gesture = useRef<Gesture | null>(null)
  const reset = () => {
    gesture.current = null
    setLocked(false)
    setOffsetX(0)
  }
  const finish = (r: Recording | null) => {
    reset()
    onDone(r)
  }
  const rec = useRecorder('voice', finish)
  const recording = rec.phase === 'recording'

  useEffect(() => onActiveChange(recording), [recording, onActiveChange])
  const cancel = () => {
    rec.cancel()
    reset()
  }
  const lock = (g: Gesture) => {
    g.holding = false
    g.lockedAt = performance.now()
    setLocked(true)
    setOffsetX(0)
  }

  const begin = async (g: Gesture) => {
    gesture.current = g
    const error = (await rec.prepare()) ?? rec.record()
    if (error) {
      cancel()
      return onError(error)
    }
    if (gesture.current !== g) return rec.cancel()
    navigator.vibrate?.(10)
    // Released while the permission prompt was open: keep recording hands-free.
    if (!g.holding) lock(g)
  }

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || recording || gesture.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    void begin({ x: e.clientX, y: e.clientY, at: performance.now(), holding: true, lockedAt: 0 })
  }

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current
    if (!g?.holding || !recording) return
    const dx = Math.min(0, e.clientX - g.x)
    if (dx < -CANCEL_PX) return cancel()
    if (e.clientY - g.y < -LOCK_PX) return lock(g)
    setOffsetX(dx)
  }

  const onPointerUp = () => {
    const g = gesture.current
    if (!g?.holding) return
    if (!recording || performance.now() - g.at < TAP_MS) return lock(g)
    g.holding = false
    void rec.stop().then(finish)
  }

  const onClick = (detail: number) => {
    const g = gesture.current
    if (!g && detail === 0 && !disabled) {
      const k: Gesture = { x: 0, y: 0, at: 0, holding: false, lockedAt: 0 }
      return void begin(k)
    }
    // The click that ends the locking tap is not a "send".
    if (g && locked && performance.now() - g.lockedAt > TAP_MS) void rec.stop().then(finish)
  }

  return (
    <div className={cn('flex items-center gap-2', recording && 'flex-1')}>
      {recording && locked && (
        <button
          type="button"
          onClick={cancel}
          aria-label={dict.media.cancel}
          className="text-muted flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <Trash2 className="size-5" />
        </button>
      )}
      {recording && (
        <div className="flex min-w-0 flex-1 items-center gap-2" role="status">
          <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-red-500" aria-hidden />
          <span className="text-sm tabular-nums">{formatDuration(rec.elapsedMs)}</span>
          {!locked && (
            <span
              className="text-muted flex flex-1 items-center justify-center gap-1 truncate text-sm"
              style={{ transform: `translateX(${offsetX}px)` }}
            >
              <ChevronLeft className="size-4" aria-hidden /> {dict.media.slideCancel}
            </span>
          )}
        </div>
      )}
      <div className="relative shrink-0">
        {recording && !locked && (
          <span className="bg-surface text-muted absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 flex-col items-center rounded-full px-2 py-2">
            <Lock className="size-4" aria-label={dict.media.slideLock} />
          </span>
        )}
        <button
          type="button"
          disabled={disabled}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => gesture.current?.holding && cancel()}
          onClick={(e) => onClick(e.detail)}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={locked ? dict.media.send : dict.media.recordVoice}
          title={dict.media.holdHint}
          className={cn(
            'flex size-11 touch-none items-center justify-center rounded-full transition select-none [-webkit-touch-callout:none] disabled:opacity-50',
            recording ? 'bg-accent text-accent-foreground scale-110' : 'text-muted',
          )}
        >
          {locked ? <SendHorizontal className="size-5" /> : <Mic className="size-6" />}
        </button>
      </div>
    </div>
  )
}
