'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyNewPeople } from '@/features/push/notify-new-people'
import {
  notifyBanChanged,
  notifyReportsResolved,
  notifyVerificationDecided,
} from '@/features/telegram/notify'
import type { ActionResult } from '@/types/action-result'
import { requireAdmin } from './guard'
import {
  banSchema,
  contentSchema,
  resolveSchema,
  reviewVerificationSchema,
  revokeSchema,
} from './schemas'

type Rpc = PromiseLike<{ error: { message: string } | null }>

// Validates, authorizes, runs the moderation RPCs in order and refreshes the panel.
async function moderate<S extends z.ZodType>(
  schema: S,
  input: unknown,
  run: (data: z.output<S>, adminId: string) => Rpc[],
): Promise<ActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Неверные данные' }
  }
  const adminId = await requireAdmin()
  for (const call of run(parsed.data, adminId)) {
    const { error } = await call
    if (error) return { ok: false, error: `Ошибка: ${error.message}` }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true, data: undefined }
}

// The selfie is kept after the review: retention is 90 days (Privacy Policy), purged by the
// daily job POST /api/cron/retention (20261008000111), so moderators can still check it when a
// report about the account comes in.
export async function reviewVerification(input: z.input<typeof reviewVerificationSchema>) {
  const result = await moderate(reviewVerificationSchema, input, (d, admin) => [
    createAdminClient().rpc('admin_review_verification', {
      p_admin: admin,
      p_request: d.requestId,
      p_approve: d.approve,
      p_reason: d.approve ? undefined : d.reason,
    }),
  ])
  // `moderate` has validated the input and authorized the admin.
  const parsed = reviewVerificationSchema.safeParse(input)
  if (result.ok && parsed.success) {
    // The Telegram copy shows the decision and the selfie photos leave the chat.
    const d = parsed.data
    notifyVerificationDecided(
      d.requestId,
      await requireAdmin(),
      d.approve,
      d.approve ? undefined : d.reason,
    )
  }
  if (result.ok && parsed.success && parsed.data.approve) {
    // A newly verified person: alert opted-in users nearby (fire-and-forget, after the response).
    const userId = await reviewedUserId(parsed.data.requestId)
    if (userId) notifyNewPeople(userId)
  }
  return result
}

async function reviewedUserId(requestId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from('verification_requests')
    .select('user_id')
    .eq('id', requestId)
    .maybeSingle()
  return data?.user_id ?? null
}

export async function setBan(input: z.input<typeof banSchema>) {
  const result = await moderate(banSchema, input, (d, admin) => [
    createAdminClient().rpc('admin_set_ban', {
      p_admin: admin,
      p_user: d.userId,
      p_banned: d.banned,
      p_reason: d.banned ? d.reason : undefined,
    }),
  ])
  const parsed = banSchema.safeParse(input)
  if (result.ok && parsed.success) {
    const d = parsed.data
    notifyBanChanged(await requireAdmin(), d.userId, d.banned, d.banned ? d.reason : undefined)
  }
  return result
}

export async function revokeVerification(input: z.input<typeof revokeSchema>) {
  return moderate(revokeSchema, input, (d, admin) => [
    createAdminClient().rpc('admin_revoke_verification', {
      p_admin: admin,
      p_user: d.userId,
      p_reason: d.reason,
    }),
  ])
}

export async function setContentHidden(input: z.input<typeof contentSchema>) {
  return moderate(contentSchema, input, (d, admin) => [
    createAdminClient().rpc('admin_set_content_hidden', {
      p_admin: admin,
      p_type: d.type,
      p_id: d.id,
      p_hidden: d.hidden,
      p_reason: d.reason,
    }),
  ])
}

// One atomic RPC (20261009000161): the sanction and the closing of every open report on the
// target happen in one transaction. The report queue uses resolveCase (report-actions.ts).
export async function resolveReports(input: z.input<typeof resolveSchema>) {
  const result = await moderate(resolveSchema, input, (d, admin) => [
    createAdminClient().rpc('admin_resolve_case', {
      p_admin: admin,
      p_type: d.targetType,
      p_target: d.targetId,
      p_decision: d.decision,
      p_reason: d.reason || undefined,
      p_offender: d.decision === 'ban' ? d.offenderId : undefined,
    }),
  ])
  const parsed = resolveSchema.safeParse(input)
  if (result.ok && parsed.success) {
    const d = parsed.data
    const adminId = await requireAdmin()
    notifyReportsResolved(d.targetType, d.targetId, adminId, RESOLVED_LABELS[d.decision])
    if (d.decision === 'ban') notifyBanChanged(adminId, d.offenderId, true, d.reason)
  }
  return result
}

const RESOLVED_LABELS = {
  dismiss: 'Отклонено: нарушения нет',
  hide: '🙈 Скрыто',
  ban: '🔨 Пользователь заблокирован',
} as const
