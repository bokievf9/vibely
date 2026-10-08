'use client'

import { useRef, useState, type PointerEvent } from 'react'
import { Pause, Play } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { WAVEFORM_PEAKS, formatDuration, nextRate, type PlaybackRate } from '../media'
import type { ChatVoice } from '../types'

type Props = { voice: ChatVoice; mine: boolean; onError: () => void }

const FLAT = Array.from({ length: WAVEFORM_PEAKS }, () => 30)
const SEEK_STEP_MS = 5_000

// Only one voice message plays at a time.
let playing: HTMLAudioElement | null = null

// Controls must not start the bubble's gestures (double tap ❤️, long press). The swipe-to-reply
// drag skips anything inside [data-no-swipe].
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

// Play/pause, a scrubbable waveform (tap or drag), elapsed/total time and 1× / 1.5× / 2×.
// The duration comes from the message: recorder WebM files carry no duration header.
export function VoicePlayer({ voice, mine, onError }: Props) {
  const { dict } = useI18n()
  const audio = useRef<HTMLAudioElement>(null)
  const [paused, setPaused] = useState(true)
  const [positionMs, setPositionMs] = useState(0)
  // While the finger is on the waveform, the finger owns the position, not the audio clock.
  const [scrubMs, setScrubMs] = useState<number | null>(null)
  const [rate, setRate] = useState<PlaybackRate>(1)
  const peaks = voice.waveform?.length ? voice.waveform : FLAT
  const shownMs = scrubMs ?? positionMs
  const progress = Math.min(1, shownMs / voice.durationMs)

  const toggle = () => {
    const el = audio.current
    if (!el) return
    if (!el.paused) return el.pause()
    if (playing && playing !== el) playing.pause()
    playing = el
    el.playbackRate = rate
    void el.play().catch(() => undefined)
  }

  const seekTo = (ms: number) => {
    const clamped = Math.min(voice.durationMs, Math.max(0, ms))
    if (audio.current) audio.current.currentTime = clamped / 1000
    setPositionMs(clamped)
  }

  const at = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * voice.durationMs
  }

  const changeRate = () => {
    const next = nextRate(rate)
    setRate(next)
    if (audio.current) audio.current.playbackRate = next
  }

  return (
    <div
      data-no-swipe
      className="flex w-64 max-w-full items-center gap-2 py-0.5"
      onPointerDown={stop}
      onClick={stop}
      onContextMenu={stop}
    >
      {voice.url && (
        <audio
          ref={audio}
          src={voice.url}
          preload="metadata"
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onTimeUpdate={(e) => setPositionMs(e.currentTarget.currentTime * 1000)}
          onEnded={() => setPositionMs(0)}
          onError={onError}
        />
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={!voice.url}
        aria-label={paused ? dict.media.play : dict.media.pause}
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-90 disabled:opacity-50',
          mine ? 'bg-accent-foreground text-accent' : 'bg-accent text-accent-foreground',
        )}
      >
        {paused ? (
          <Play className="size-5 fill-current" />
        ) : (
          <Pause className="size-5 fill-current" />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div
          role="slider"
          tabIndex={0}
          aria-label={dict.media.voice}
          aria-valuemin={0}
          aria-valuemax={Math.round(voice.durationMs / 1000)}
          aria-valuenow={Math.round(shownMs / 1000)}
          aria-valuetext={formatDuration(shownMs)}
          // 32px tall touch strip around the 28px waveform; touch-none: the finger scrubs.
          className="flex h-8 cursor-pointer touch-none items-center gap-px outline-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setScrubMs(at(e))
          }}
          onPointerMove={(e) => {
            if (scrubMs !== null) setScrubMs(at(e))
          }}
          onPointerUp={(e) => {
            if (scrubMs === null) return
            seekTo(at(e))
            setScrubMs(null)
          }}
          onPointerCancel={() => setScrubMs(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') seekTo(positionMs + SEEK_STEP_MS)
            else if (e.key === 'ArrowLeft') seekTo(positionMs - SEEK_STEP_MS)
          }}
        >
          {peaks.map((p, i) => (
            <span
              key={i}
              className={cn(
                'h-7 min-w-0 flex-1 origin-center rounded-full bg-current',
                i / peaks.length >= progress && 'opacity-35',
              )}
              style={{ transform: `scaleY(${Math.max(0.08, p / 100)})` }}
            />
          ))}
        </div>
        <span className="text-[11px] tabular-nums opacity-80">
          {formatDuration(paused && !shownMs ? voice.durationMs : shownMs)}
        </span>
      </div>
      <button
        type="button"
        onClick={changeRate}
        aria-label={dict.media.speed}
        className="flex h-8 min-w-11 shrink-0 items-center justify-center rounded-full bg-neutral-950/15 px-2 text-xs font-semibold tabular-nums transition-transform duration-150 ease-out active:scale-90"
      >
        {rate}×
      </button>
    </div>
  )
}
