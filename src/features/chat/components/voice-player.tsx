'use client'

import { useRef, useState, type MouseEvent } from 'react'
import { Pause, Play } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { WAVEFORM_PEAKS, formatDuration, nextRate, type PlaybackRate } from '../media'
import type { ChatVoice } from '../types'

type Props = { voice: ChatVoice; mine: boolean; onError: () => void }

const FLAT = Array.from({ length: WAVEFORM_PEAKS }, () => 30)

// Only one voice message plays at a time.
let playing: HTMLAudioElement | null = null

// Controls must not start the bubble's gestures (swipe-to-reply, double tap ❤️).
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

// Play/pause, waveform with progress (tap to seek), elapsed/total time and 1× / 1.5× / 2×.
// The duration comes from the message: recorder WebM files carry no duration header.
export function VoicePlayer({ voice, mine, onError }: Props) {
  const { dict } = useI18n()
  const audio = useRef<HTMLAudioElement>(null)
  const [paused, setPaused] = useState(true)
  const [positionMs, setPositionMs] = useState(0)
  const [rate, setRate] = useState<PlaybackRate>(1)
  const peaks = voice.waveform?.length ? voice.waveform : FLAT
  const progress = Math.min(1, positionMs / voice.durationMs)

  const toggle = () => {
    const el = audio.current
    if (!el) return
    if (!el.paused) return el.pause()
    if (playing && playing !== el) playing.pause()
    playing = el
    el.playbackRate = rate
    void el.play().catch(() => undefined)
  }

  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const el = audio.current
    if (!el) return
    const box = e.currentTarget.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
    el.currentTime = (fraction * voice.durationMs) / 1000
    setPositionMs(fraction * voice.durationMs)
  }

  const changeRate = () => {
    const next = nextRate(rate)
    setRate(next)
    if (audio.current) audio.current.playbackRate = next
  }

  return (
    <div className="flex w-60 max-w-full items-center gap-2 py-0.5" onPointerDown={stop}>
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
          'flex size-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50',
          mine ? 'bg-accent-foreground text-accent' : 'bg-accent text-accent-foreground',
        )}
      >
        {paused ? (
          <Play className="size-5 fill-current" />
        ) : (
          <Pause className="size-5 fill-current" />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          className="flex h-7 cursor-pointer items-center gap-px"
          onClick={seek}
          role="presentation"
        >
          {peaks.map((p, i) => (
            <span
              key={i}
              className={cn(
                'min-h-0.5 flex-1 rounded-full',
                i / peaks.length < progress ? 'bg-current' : 'bg-current opacity-35',
              )}
              style={{ height: `${Math.max(8, p)}%` }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] tabular-nums opacity-80">
          <span>{formatDuration(paused && !positionMs ? voice.durationMs : positionMs)}</span>
          <button
            type="button"
            onClick={changeRate}
            aria-label={dict.media.speed}
            className="rounded-full bg-black/15 px-1.5 font-semibold"
          >
            {rate}×
          </button>
        </div>
      </div>
    </div>
  )
}
