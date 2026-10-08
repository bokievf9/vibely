'use client'

import { useEffect, useRef, useState } from 'react'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { VIDEO_MAX_MS, VOICE_MAX_MS, pickRecorderMime, toWaveform, type RecordKind } from '../media'

export type Recording = { blob: Blob; mime: string; durationMs: number; waveform: number[] | null }

type Phase = 'idle' | 'ready' | 'recording'

type Live = {
  stream: MediaStream
  recorder?: MediaRecorder
  chunks: Blob[]
  startedAt: number
  levels: number[]
  audio?: AudioContext
  timer?: ReturnType<typeof setInterval>
}

// Stops the timer, the camera/mic and Web Audio.
function shutDown(l: Live | null) {
  if (!l) return
  clearInterval(l.timer)
  l.stream.getTracks().forEach((t) => t.stop())
  void l.audio?.close().catch(() => undefined)
}

const TICK_MS = 100
const METER_SAMPLES = 32

const CONSTRAINTS: Record<RecordKind, MediaStreamConstraints> = {
  voice: { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } },
  // Square, small and front-facing: the circle is cropped from it with object-fit.
  video: {
    audio: { echoCancellation: true, noiseSuppression: true },
    video: {
      facingMode: 'user',
      width: { ideal: 480 },
      height: { ideal: 480 },
      aspectRatio: { ideal: 1 },
      frameRate: { ideal: 24, max: 30 },
    },
  },
}

const BITRATES: Record<RecordKind, MediaRecorderOptions> = {
  voice: { audioBitsPerSecond: 32_000 },
  video: { videoBitsPerSecond: 500_000, audioBitsPerSecond: 48_000 },
}

const MAX_MS: Record<RecordKind, number> = { voice: VOICE_MAX_MS, video: VIDEO_MAX_MS }

const deniedError = (kind: RecordKind): ErrorKey =>
  kind === 'voice' ? 'micDenied' : 'cameraDenied'

// MediaRecorder around getUserMedia. prepare() opens the mic/camera (video shows a preview first),
// record() starts, stop() resolves with the file, cancel() discards it. At the length limit the
// recording stops by itself and `onLimit` gets it. Voice also samples loudness for the waveform.
export function useRecorder(kind: RecordKind, onLimit: (r: Recording | null) => void) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  // Recent loudness samples (0..1, newest last) while recording voice: the live level meter.
  const [levels, setLevels] = useState<number[]>([])
  const [stream, setStream] = useState<MediaStream | null>(null)
  const live = useRef<Live | null>(null)
  const limitRef = useRef(onLimit)
  useEffect(() => {
    limitRef.current = onLimit
  })

  const release = () => {
    shutDown(live.current)
    live.current = null
    setStream(null)
    setPhase('idle')
    setElapsedMs(0)
    setLevels([])
  }

  // Leaving the chat mid-recording turns the mic/camera off.
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      shutDown(liveOf(live))
      live.current = null
    }
  }, [])

  const prepare = async (): Promise<ErrorKey | null> => {
    if (live.current) return null
    const mime =
      typeof MediaRecorder === 'undefined'
        ? null
        : pickRecorderMime(kind, (t) => MediaRecorder.isTypeSupported(t))
    if (!mime || !navigator.mediaDevices?.getUserMedia) return 'recordingUnsupported'
    try {
      const s = await navigator.mediaDevices.getUserMedia(CONSTRAINTS[kind])
      // Closed meanwhile, or a parallel call won: don't leave a camera/mic running.
      if (!alive.current || live.current) {
        s.getTracks().forEach((t) => t.stop())
        return null
      }
      live.current = { stream: s, chunks: [], startedAt: 0, levels: [] }
      setStream(s)
      setPhase('ready')
      return null
    } catch (e) {
      return e instanceof DOMException && e.name === 'NotAllowedError'
        ? deniedError(kind)
        : 'recordingUnsupported'
    }
  }

  const stop = (): Promise<Recording | null> => {
    const l = live.current
    const recorder = l?.recorder
    if (!l || !recorder || recorder.state === 'inactive') {
      release()
      return Promise.resolve(null)
    }
    clearInterval(l.timer)
    const durationMs = Math.min(performance.now() - l.startedAt, MAX_MS[kind])
    return new Promise((resolve) => {
      recorder.addEventListener('stop', () => {
        const mime = recorder.mimeType || l.chunks[0]?.type || ''
        const blob = new Blob(l.chunks, { type: mime })
        const waveform = kind === 'voice' && l.levels.length ? toWaveform(l.levels) : null
        release()
        resolve(blob.size ? { blob, mime, durationMs: Math.round(durationMs), waveform } : null)
      })
      recorder.stop()
    })
  }

  const record = (): ErrorKey | null => {
    const l = live.current
    const mime = pickRecorderMime(kind, (t) => MediaRecorder.isTypeSupported(t))
    if (!l || !mime || l.recorder) return 'recordingUnsupported'
    try {
      l.recorder = new MediaRecorder(l.stream, { mimeType: mime, ...BITRATES[kind] })
    } catch {
      return 'recordingUnsupported'
    }
    l.recorder.addEventListener('dataavailable', (e) => e.data.size && l.chunks.push(e.data))
    const sample = kind === 'voice' ? loudnessSampler(l.stream, (ctx) => (l.audio = ctx)) : null
    l.recorder.start(1000)
    l.startedAt = performance.now()
    setPhase('recording')
    l.timer = setInterval(() => {
      const elapsed = performance.now() - l.startedAt
      setElapsedMs(elapsed)
      const level = sample?.()
      if (level !== undefined) {
        l.levels.push(level)
        setLevels((prev) => [...prev.slice(1 - METER_SAMPLES), level])
      }
      if (elapsed >= MAX_MS[kind]) void stop().then((r) => limitRef.current(r))
    }, TICK_MS)
    return null
  }

  return { phase, elapsedMs, levels, stream, prepare, record, stop, cancel: release }
}

const liveOf = (ref: { current: Live | null }) => ref.current

// RMS loudness of the latest audio frame (0..1), or undefined when Web Audio is not available.
function loudnessSampler(stream: MediaStream, keep: (ctx: AudioContext) => void) {
  try {
    const ctx = new AudioContext()
    keep(ctx)
    void ctx.resume().catch(() => undefined)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)
    const frame = new Uint8Array(analyser.fftSize)
    return () => {
      analyser.getByteTimeDomainData(frame)
      let sum = 0
      for (const v of frame) sum += ((v - 128) / 128) ** 2
      return Math.sqrt(sum / frame.length)
    }
  } catch {
    return null
  }
}
