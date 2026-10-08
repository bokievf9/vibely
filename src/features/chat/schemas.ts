import { z } from 'zod'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { VIDEO_MAX_MS, VOICE_MAX_MS, WAVEFORM_PEAKS } from './media'
import { REACTIONS } from './types'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

export const bodySchema = z
  .string()
  .trim()
  .max(2000, { error: 'messageTooLong' satisfies ErrorKey })

export const imageSchema = z.object({
  path: z.string().regex(new RegExp(`^${UUID}/${UUID}\\.webp$`)),
  width: z.int().min(1).max(10000),
  height: z.int().min(1).max(10000),
})

// +1 s: the recorder's last chunk can run slightly past the limit (same slack as the DB check).
const SLACK_MS = 1000

// Voice message / video circle already uploaded to chat-media; the extension matches the MIME
// type (also enforced by the messages_media_path check).
export const recordingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('voice'),
    path: z.string().regex(new RegExp(`^${UUID}/${UUID}\\.(webm|m4a)$`)),
    mime: z.enum(['audio/webm', 'audio/mp4']),
    durationMs: z
      .int()
      .min(1)
      .max(VOICE_MAX_MS + SLACK_MS),
    waveform: z.array(z.int().min(0).max(100)).min(1).max(WAVEFORM_PEAKS).nullish(),
  }),
  z.object({
    kind: z.literal('video'),
    path: z.string().regex(new RegExp(`^${UUID}/${UUID}\\.(webm|mp4)$`)),
    mime: z.enum(['video/webm', 'video/mp4']),
    durationMs: z
      .int()
      .min(1)
      .max(VIDEO_MAX_MS + SLACK_MS),
  }),
])

const extensionMatches = (r: z.infer<typeof recordingSchema>) =>
  r.path.endsWith(r.mime === 'audio/mp4' ? '.m4a' : r.mime.endsWith('/mp4') ? '.mp4' : '.webm')

export const sendSchema = z
  .object({
    matchId: z.uuid(),
    body: bodySchema.optional(),
    replyTo: z.uuid().nullish(),
    image: imageSchema.nullish(),
    recording: recordingSchema.nullish(),
  })
  .refine(
    (v) =>
      !(v.image && v.recording) &&
      (!v.image || v.image.path.startsWith(`${v.matchId}/`)) &&
      (!v.recording ||
        (v.recording.path.startsWith(`${v.matchId}/`) && extensionMatches(v.recording))),
    { error: 'invalidInput' satisfies ErrorKey },
  )

export const editSchema = z.object({
  messageId: z.uuid(),
  body: bodySchema.min(1, { error: 'messageEmpty' satisfies ErrorKey }),
})

export const reactSchema = z.object({
  messageId: z.uuid(),
  emoji: z.enum(REACTIONS).nullable(),
})
