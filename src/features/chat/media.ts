// Pure helpers for voice messages and video circles. Dependency-free (relative type imports only),
// so they are unit-tested with `node --test` (tests/unit/chat-media.test.mjs).
import type { MediaKind } from './types'

export const VOICE_MAX_MS = 120_000
export const VIDEO_MAX_MS = 60_000
// Shorter recordings are treated as an accidental tap and dropped.
export const MIN_RECORDING_MS = 700
export const WAVEFORM_PEAKS = 48

export type RecordKind = Exclude<MediaKind, 'image'>

// What the chat-media bucket and the messages checks accept (20261008000110).
export type MediaMime = 'image/webp' | 'audio/webm' | 'audio/mp4' | 'video/webm' | 'video/mp4'

const EXTENSIONS: Record<MediaMime, string> = {
  'image/webp': 'webp',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
}

// Preference order for MediaRecorder. Voice: Opus in WebM (Chrome/Android/Firefox), AAC in MP4
// on iOS Safari. Video: MP4 first where the browser can record it (H.264 plays everywhere,
// including iPhones), WebM otherwise.
const CANDIDATES: Record<RecordKind, string[]> = {
  voice: ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm'],
  video: [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ],
}

// The first recorder MIME type the browser supports, or null (no recording possible).
export function pickRecorderMime(
  kind: RecordKind,
  isTypeSupported: (type: string) => boolean,
): string | null {
  return CANDIDATES[kind].find((type) => isTypeSupported(type)) ?? null
}

// Storage MIME type and file extension for what the recorder produced ("audio/webm;codecs=opus"
// → audio/webm, .webm). null when the container is not one we accept.
export function storedFormat(
  kind: RecordKind,
  recorderMime: string,
): { mime: MediaMime; ext: string } | null {
  const base = recorderMime.split(';')[0]?.trim().toLowerCase() ?? ''
  const container = base.endsWith('/mp4') ? 'mp4' : base.endsWith('/webm') ? 'webm' : null
  if (!container) return null
  const mime: MediaMime = `${kind === 'voice' ? 'audio' : 'video'}/${container}`
  return { mime, ext: EXTENSIONS[mime] }
}

// Loudness samples (any scale, ≥ 0) → `count` peaks 0..100, normalised to the loudest one.
export function toWaveform(levels: number[], count = WAVEFORM_PEAKS): number[] {
  if (!levels.length) return []
  const peaks = Array.from({ length: count }, (_, i) => {
    const from = Math.floor((i * levels.length) / count)
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / count))
    return Math.max(...levels.slice(from, to))
  })
  const max = Math.max(...peaks)
  return peaks.map((p) => (max > 0 ? Math.round((p / max) * 100) : 0))
}

// 0:07, 1:59
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export const PLAYBACK_RATES = [1, 1.5, 2] as const
export type PlaybackRate = (typeof PLAYBACK_RATES)[number]

export const nextRate = (rate: PlaybackRate): PlaybackRate =>
  PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(rate) + 1) % PLAYBACK_RATES.length] ?? 1
