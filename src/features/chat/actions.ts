'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, zodErrorKey, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { planFail } from '@/features/plans/errors'
import { notifyNewMessage } from '@/features/push/send'
import { hydrateMessages } from './hydrate'
import { MESSAGE_COLUMNS } from './message-row'
import { sendSchema } from './schemas'
import type { ChatMessage } from './types'

// Text, photo (already uploaded to chat-media by the browser) or both, or a voice message / video
// circle; optionally a reply. The database checks that the quoted message and the file belong to
// the same match, and the per-kind limits (20261008000110).
export async function sendMessage(
  input: z.input<typeof sendSchema>,
): Promise<UserResult<ChatMessage>> {
  const parsed = sendSchema.safeParse(input)
  if (!parsed.success) return fail(zodErrorKey(parsed.error))
  const { matchId, replyTo, image, recording } = parsed.data
  // Recordings carry no caption.
  const body = parsed.data.body && !recording ? sanitizeText(parsed.data.body) : ''
  if (!body && !image && !recording) return fail('messageEmpty')
  const media = image
    ? {
        media_kind: 'image',
        media_path: image.path,
        media_mime: 'image/webp',
        image_width: image.width,
        image_height: image.height,
      }
    : recording
      ? {
          media_kind: recording.kind,
          media_path: recording.path,
          media_mime: recording.mime,
          media_duration_ms: recording.durationMs,
          waveform: recording.kind === 'voice' ? (recording.waveform ?? null) : null,
        }
      : {}

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .insert({
      match_id: matchId,
      body: body || null,
      reply_to: replyTo ?? null,
      ...media,
    })
    .select(MESSAGE_COLUMNS)
    .single()
  if (error) {
    // VP402: photos, voice and video messages need Plus (20261009000280).
    const gated = planFail(error)
    if (gated) return gated
    const key = image ? 'photoSendFailed' : recording ? 'mediaSendFailed' : 'generic'
    return fail(rateLimitedOr(error.code, key))
  }
  notifyNewMessage(matchId, data.sender_id, image ? 'photo' : (recording?.kind ?? 'text'))
  const [message] = await hydrateMessages(supabase, [data])
  return message ? ok(message) : fail('generic')
}

export async function markRead(matchId: string): Promise<void> {
  const id = z.uuid().safeParse(matchId)
  const viewer = await getViewer()
  if (!id.success || !viewer) return
  const supabase = await createClient()
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('match_id', id.data)
    .neq('sender_id', viewer.id)
    .is('read_at', null)
}

export async function unmatch(matchId: string): Promise<UserResult> {
  const id = z.uuid().safeParse(matchId)
  if (!id.success) return fail('invalidInput')
  const supabase = await createClient()
  const { error } = await supabase.from('matches').delete().eq('id', id.data)
  return error ? fail('generic') : ok(undefined)
}
