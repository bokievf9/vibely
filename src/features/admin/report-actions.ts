'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLiveKitEnv } from '@/features/calls/server/env'
import { closeCallRoom } from '@/features/calls/server/livekit'
import { notifyBanChanged, notifyReportsResolved } from '@/features/telegram/notify'
import type { ActionResult } from '@/types/action-result'
import { adminWithRole } from './guard'
import { DECISION_LABELS } from './report-labels'
import {
  bulkDismissSchema,
  caseSchema,
  resolveCaseSchema,
  type ResolveCaseInput,
} from './report-schemas'

const invalid = (issues: z.core.$ZodIssue[]): ActionResult<never> => ({
  ok: false,
  error: issues[0]?.message ?? 'Неверные данные',
})

const noRole: ActionResult<never> = { ok: false, error: 'Нужна роль «Модератор» или выше' }

// Postgres errors raised by the queue RPCs, in moderator language.
function rpcError(error: { code?: string; message: string }): ActionResult<never> {
  if (error.code === '42501') return { ok: false, error: 'Недостаточно прав для этого действия' }
  if (error.code === '55P03') return { ok: false, error: 'Жалобу уже взял другой модератор' }
  if (error.code === 'P0002' && /No open reports/.test(error.message))
    return { ok: false, error: 'Жалоба уже закрыта' }
  return { ok: false, error: `Ошибка: ${error.message}` }
}

// One decision on a case: sanction and closing of every open report in one transaction
// (admin_resolve_case). Bans follow the role rules (moderators 7 days, admins permanent). Calls the
// ban ended get their LiveKit rooms closed, a deleted photo's file is removed from storage, and
// the Telegram copy of the report is closed.
export async function resolveCase(input: ResolveCaseInput): Promise<ActionResult> {
  const parsed = resolveCaseSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const adminId = (await adminWithRole('moderator'))?.id
  if (!adminId) return noRole
  const d = parsed.data
  const db = createAdminClient()

  const { data, error } = await db.rpc('admin_resolve_case', {
    p_admin: adminId,
    p_type: d.targetType,
    p_target: d.targetId,
    p_decision: d.decision,
    p_reason: d.reason || undefined,
    p_offender: d.decision === 'ban' ? d.offenderId : undefined,
  })
  if (error) return rpcError(error)

  revalidatePath('/admin', 'layout')
  const out = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  const offender = typeof out.offender === 'string' ? out.offender : null
  notifyReportsResolved(d.targetType, d.targetId, adminId, DECISION_LABELS[d.decision])
  if (d.decision === 'ban' && offender) notifyBanChanged(adminId, offender, true, d.reason)
  const endedCalls = Array.isArray(out.ended_calls)
    ? out.ended_calls.filter((id): id is string => typeof id === 'string')
    : []
  const env = getLiveKitEnv()
  if (env && endedCalls.length)
    after(() => Promise.all(endedCalls.map((id) => closeCallRoom(env, id))))
  const photoPath = out.photo_path
  if (typeof photoPath === 'string') {
    const { error: storageError } = await db.storage.from('profile-photos').remove([photoPath])
    if (storageError)
      return { ok: false, error: `Жалоба закрыта, но файл фото не удалён: ${storageError.message}` }
  }
  return { ok: true, data: undefined }
}

export async function claimCase(input: z.input<typeof caseSchema>): Promise<ActionResult> {
  const parsed = caseSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const adminId = (await adminWithRole('moderator'))?.id
  if (!adminId) return noRole
  const { error } = await createAdminClient().rpc('admin_claim_report', {
    p_admin: adminId,
    p_type: parsed.data.targetType,
    p_target: parsed.data.targetId,
  })
  if (error) return rpcError(error)
  revalidatePath('/admin/reports')
  return { ok: true, data: undefined }
}

export async function releaseCase(input: z.input<typeof caseSchema>): Promise<ActionResult> {
  const parsed = caseSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const adminId = (await adminWithRole('moderator'))?.id
  if (!adminId) return noRole
  const { error } = await createAdminClient().rpc('admin_release_report', {
    p_admin: adminId,
    p_type: parsed.data.targetType,
    p_target: parsed.data.targetId,
  })
  if (error) return rpcError(error)
  revalidatePath('/admin/reports')
  return { ok: true, data: undefined }
}

// Dismisses several cases; each one is resolved and logged on its own. Cases closed meanwhile or
// held by another moderator are skipped.
export async function bulkDismiss(
  input: z.input<typeof bulkDismissSchema>,
): Promise<ActionResult<{ dismissed: number; skipped: number }>> {
  const parsed = bulkDismissSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const adminId = (await adminWithRole('moderator'))?.id
  if (!adminId) return noRole
  const { cases, reason } = parsed.data
  const { data, error } = await createAdminClient().rpc('admin_bulk_dismiss', {
    p_admin: adminId,
    p_targets: cases.map((c) => ({ type: c.targetType, id: c.targetId })),
    p_reason: reason || undefined,
  })
  if (error) return rpcError(error)
  revalidatePath('/admin', 'layout')
  return { ok: true, data: { dismissed: data, skipped: cases.length - data } }
}
