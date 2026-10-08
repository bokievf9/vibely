'use client'

import { useRef, useState, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  min: number
  max: number
  // One value: a plain slider. Two values: a range with two thumbs that can't cross.
  values: number[]
  onChange: (values: number[]) => void
  // Accessible name per thumb ("Minimum age", "Maximum age").
  labels: string[]
  valueText: (value: number) => string
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Touch-first slider: the whole 44px-tall strip is the hit area and the nearest thumb follows the
// finger. Each thumb is backed by a real <input type="range"> (role slider), so keyboard and
// screen readers get native behavior: arrows, Page Up/Down, Home/End, value announcements.
export function RangeSlider({ min, max, values, onChange, labels, valueText }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const [active, setActive] = useState<number | null>(null)
  const pointer = useRef<number | null>(null)
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const range = values.length === 2
  const first = values[0] ?? min
  const second = values[1] ?? max
  // Each thumb is bounded by the other one, so the two can meet but never cross.
  const lowerBound = (i: number) => (i === 1 ? first : min)
  const upperBound = (i: number) => (i === 0 && range ? second : max)

  const set = (index: number, raw: number) => {
    const next = [...values]
    next[index] = clamp(Math.round(raw), lowerBound(index), upperBound(index))
    if (next[index] !== values[index]) onChange(next)
  }

  const valueAt = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return min
    return min + clamp((clientX - rect.left) / rect.width, 0, 1) * (max - min)
  }

  // Nearest thumb wins; when both sit on the same value, the drag direction's side wins.
  const pick = (v: number) => {
    if (!range) return 0
    if (first === second) return v < first ? 0 : 1
    return Math.abs(v - first) <= Math.abs(v - second) ? 0 : 1
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== null || (e.pointerType === 'mouse' && e.button !== 0)) return
    const v = valueAt(e.clientX)
    const index = pick(v)
    pointer.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    setActive(index)
    inputs.current[index]?.focus({ preventScroll: true })
    set(index, v)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (active === null || e.pointerId !== pointer.current) return
    set(active, valueAt(e.clientX))
  }

  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointer.current) return
    pointer.current = null
    setActive(null)
  }

  const from = range ? pct(first) : 0
  const to = pct(range ? second : first)

  return (
    <div
      className="relative h-11 touch-pan-y select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div ref={track} className="absolute inset-x-3.5 top-1/2 h-1.5 -translate-y-1/2">
        <div className="bg-border absolute inset-0 rounded-full" />
        <div
          className="bg-accent absolute inset-y-0 rounded-full"
          style={{ left: `${from}%`, right: `${100 - to}%` }}
        />
        {values.map((value, i) => (
          <div
            key={i}
            className="absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${pct(value)}%` }}
          >
            <input
              ref={(node) => {
                inputs.current[i] = node
              }}
              type="range"
              className="peer sr-only"
              min={lowerBound(i)}
              max={upperBound(i)}
              value={value}
              aria-label={labels[i]}
              aria-valuetext={valueText(value)}
              onChange={(e) => set(i, Number(e.target.value))}
            />
            <span
              aria-hidden
              className={cn(
                'size-7 rounded-full bg-white shadow-md shadow-black/40 transition-transform duration-150 ease-out',
                'peer-focus-visible:ring-accent peer-focus-visible:ring-offset-surface peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2',
                active === i && 'scale-110',
              )}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
