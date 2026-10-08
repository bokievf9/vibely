'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ChevronLeft, Lock, Mic, SendHorizontal, Trash2 } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { haptic } from '@/lib/haptics'
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

// RMS loudness of speech sits around 0.02 to 0.3: spread it over the meter's range.
const meter = (level: number) => Math.min(1, Math.sqrt(level) * 2.2)

// Telegram-style mic: hold to record and release to send, slide left to cancel, slide up to lock.
// A short tap (or the keyboard) starts hands-free recording right away; then tap send.
export function VoiceRecorder({ disabled, onActiveChange, onDone, onError }: Props) {
  const { dict } = useI18n()
  const [locked, setLocked] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const gesture = useRef<Gesture | null>(null)
  const reset = () => {
    gesture.current = null
    setLocked(false)
    setOffset({ x: 0, y: 0 })
  }
  const finish = (r: Recording | null) => {
    reset()
    onDone(r)
  }
  const rec = useRecorder('voice', finish)
  const recording = rec.phase === 'recording'
  const level = meter(rec.levels.at(-1) ?? 0)

  useEffect(() => onActiveChange(recording), [recording, onActiveChange])
  const cancel = () => {
    rec.cancel()
    reset()
  }
  const lock = (g: Gesture) => {
    g.holding = false
    g.lockedAt = performance.now()
    setLocked(true)
    setOffset({ x: 0, y: 0 })
  }

  const begin = async (g: Gesture) => {
    gesture.current = g
    const error = (await rec.prepare()) ?? rec.record()
    if (error) {
      cancel()
      return onError(error)
    }
    if (gesture.current !== g) return rec.cancel()
    haptic('light')
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
    const dy = Math.min(0, e.clientY - g.y)
    if (dx < -CANCEL_PX) {
      haptic('warning')
      return cancel()
    }
    if (dy < -LOCK_PX) {
      haptic('medium')
      return lock(g)
    }
    setOffset({ x: dx, y: dy })
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

  const discard = () => {
    haptic('warning')
    cancel()
  }

  return (
    <div className={cn('flex items-center gap-1', recording && 'min-w-0 flex-1')}>
      {recording && locked && (
        <button
          type="button"
          onClick={discard}
          aria-label={dict.media.cancel}
          className="text-muted active:bg-surface flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,transform,scale] duration-150 ease-out active:scale-90"
        >
          <Trash2 className="size-5" />
        </button>
      )}
      {recording && (
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-2" role="status">
          <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-red-500" aria-hidden />
          <span className="w-10 shrink-0 text-sm tabular-nums">
            {formatDuration(rec.elapsedMs)}
          </span>
          {locked ? (
            <LevelMeter levels={rec.levels} />
          ) : (
            <span
              className="text-muted flex min-w-0 flex-1 items-center justify-center gap-1 text-sm"
              style={{
                transform: `translateX(${offset.x}px)`,
                opacity: 1 - Math.min(0.8, -offset.x / CANCEL_PX),
              }}
            >
              <ChevronLeft className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{dict.media.slideCancel}</span>
            </span>
          )}
        </div>
      )}
      <div className="relative shrink-0">
        {recording && !locked && (
          // Rides up with the finger; turns accent near the lock point.
          <span
            className={cn(
              'absolute bottom-full left-1/2 mb-2 -ml-4 flex w-8 flex-col items-center rounded-full py-2 shadow-lg transition-colors duration-150',
              offset.y < -LOCK_PX * 0.6
                ? 'bg-accent text-accent-foreground'
                : 'bg-surface text-muted',
            )}
            style={{ transform: `translateY(${Math.max(-LOCK_PX, offset.y) * 0.5}px)` }}
          >
            <Lock className="size-4" aria-label={dict.media.slideLock} />
          </span>
        )}
        {recording && (
          // Live input level: the halo breathes with the voice.
          <span
            aria-hidden
            className="bg-accent/25 pointer-events-none absolute inset-0 rounded-full transition-transform duration-100 ease-linear"
            style={{ transform: `scale(${1 + level * 0.55})` }}
          />
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
            'relative flex size-11 touch-none items-center justify-center rounded-full transition-[background-color,color] duration-150 ease-out select-none [-webkit-touch-callout:none] disabled:opacity-50',
            recording ? 'bg-accent text-accent-foreground' : 'text-muted active:bg-surface',
          )}
        >
          {locked ? <SendHorizontal className="size-5" /> : <Mic className="size-6" />}
        </button>
      </div>
    </div>
  )
}

// The last few seconds of loudness as bars (scaleY: no layout work per sample).
function LevelMeter({ levels }: { levels: number[] }) {
  return (
    <span
      className="flex h-6 min-w-0 flex-1 items-center justify-end gap-0.5 overflow-hidden"
      aria-hidden
    >
      {levels.map((l, i) => (
        <span
          key={i}
          className="bg-accent h-full w-[3px] shrink-0 rounded-full"
          style={{ transform: `scaleY(${Math.max(0.12, meter(l))})` }}
        />
      ))}
    </span>
  )
}
