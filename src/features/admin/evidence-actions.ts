'use server'

import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/types/action-result'
import { adminWithRole } from './guard'
import { chatMediaSchema, evidenceSchema } from './report-schemas'

// Evidence viewers of the report card (CLAUDE.md "Safety recording & data retention"). The
// database checks that the moderator handles an open report and that the chat belongs to its two
// parties, and logs every access (evidence.transcript_open / evidence.media_open) before anything
// is returned. Media gets a signed URL valid for two minutes.
const MEDIA_URL_TTL_S = 120

export type TranscriptMessage = {
  id: string
  senderId: string
  body: string | null
  mediaKind: 'image' | 'voice' | 'video' | null
  hasMedia: boolean
  durationMs: number | null
  createdAt: string
  edited: boolean
  deleted: boolean
  unmatched: boolean
  reported: boolean
}

const MEDIA_KINDS = ['image', 'voice', 'video'] as const
const mediaKind = (k: string | null) => MEDIA_KINDS.find((m) => m === k) ?? null

export async function openTranscript(
  input: z.input<typeof evidenceSchema>,
): Promise<ActionResult<TranscriptMessage[]>> {
  const parsed = evidenceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Неверные данные' }
  const adminId = (await adminWithRole('moderator'))?.id
  if (!adminId) return { ok: false, error: 'Нужна роль «Модератор» или выше' }
  const { data, error } = await createAdminClient().rpc('admin_open_chat_transcript', {
    p_admin: adminId,
    p_type: parsed.data.targetType,
    p_target: parsed.data.targetId,
    p_reporter: parsed.data.reporterId,
  })
  if (error) return { ok: false, error: `Ошибка: ${error.message}` }
  return {
    ok: true,
    data: (data ?? []).map((m) => ({
      id: m.message_id,
      senderId: m.sender_id,
      body: m.body,
      mediaKind: mediaKind(m.media_kind),
      hasMedia: m.has_media,
      durationMs: m.media_duration_ms,
      createdAt: m.created_at,
      edited: m.edited_at !== null,
      deleted: m.deleted,
      unmatched: m.unmatched,
      reported: m.reported,
    })),
  }
}

export async function openChatMedia(
  input: z.input<typeof chatMediaSchema>,
): Promise<ActionResult<{ url: string; kind: 'image' | 'voice' | 'video'; mime: string }>> {
  const parsed = chatMediaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Неверные данные' }
  const adminId = (await adminWithRole('moderator'))?.id
  if (!adminId) return { ok: false, error: 'Нужна роль «Модератор» или выше' }
  const db = createAdminClient()
  const { data, error } = await db.rpc('admin_open_chat_media', {
    p_admin: adminId,
    p_type: parsed.data.targetType,
    p_target: parsed.data.targetId,
    p_reporter: parsed.data.reporterId,
    p_message: parsed.data.messageId,
  })
  const row = data?.[0]
  if (error || !row) return { ok: false, error: `Ошибка: ${error?.message ?? 'нет файла'}` }
  const kind = mediaKind(row.media_kind)
  if (!kind) return { ok: false, error: 'Неизвестный тип файла' }

  const { data: signed, error: signError } = await db.storage
    .from('chat-media')
    .createSignedUrl(row.path, MEDIA_URL_TTL_S)
  if (signError || !signed) return { ok: false, error: 'Файл не найден в хранилище' }
  return { ok: true, data: { url: signed.signedUrl, kind, mime: row.media_mime } }
}
