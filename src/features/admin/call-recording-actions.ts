'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { RECORDING_URL_TTL_S, signRecordingUrl } from '@/features/calls/server/recordings'
import type { ActionResult } from '@/types/action-result'
import { requireAdmin } from './guard'

const schema = z.object({ callId: z.uuid(), reportTarget: z.uuid() })

// Opens a call recording for a moderator handling a report. The database re-checks the moderator
// and that the call's pair is under an open report, and logs the access in moderation_actions
// ("call.recording_open") before we sign a short-lived URL (CLAUDE.md: recordings protocol).
export async function openCallRecording(
  input: z.input<typeof schema>,
): Promise<ActionResult<{ url: string; expiresInSec: number }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Неверные данные' }
  const adminId = await requireAdmin()

  const { data: path, error } = await createAdminClient().rpc('admin_open_call_recording', {
    p_admin: adminId,
    p_call: parsed.data.callId,
    p_reason: `Проверка жалобы на пользователя ${parsed.data.reportTarget}`,
  })
  if (error || !path) return { ok: false, error: `Ошибка: ${error?.message ?? 'нет записи'}` }
  try {
    const url = await signRecordingUrl(path)
    return { ok: true, data: { url, expiresInSec: RECORDING_URL_TTL_S } }
  } catch (e) {
    console.error('[admin] sign recording', e)
    return { ok: false, error: 'Не удалось создать ссылку на запись' }
  }
}
