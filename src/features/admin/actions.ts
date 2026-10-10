'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLiveKitEnv } from '@/features/calls/server/env'
import { closeCallRoom } from '@/features/calls/server/livekit'
import { notifyNewPeople } from '@/features/push/notify-new-people'
import {
  notifyBanChanged,
  notifyUnderageDecided,
  notifyVerificationDecided,
} from '@/features/telegram/notify'
import type { ActionResult } from '@/types/action-result'
import { requireAdmin } from './guard'
import { resolveCase } from './report-actions'
import {
  banSchema,
  contentSchema,
  resolveSchema,
  reviewVerificationSchema,
  revokeSchema,
  underageSchema,
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

// "Looks under 18" (admin_reject_underage, 20261010000100): rejects the selfie, bans the account
// with the code 'underage' (moderators 7 days, admins permanently; an admin can extend it on the
// user page), hides the profile and logs it, in one transaction. The calls the ban ended get their
// LiveKit rooms closed; the Telegram copy of the selfie is closed (photos deleted) and the ban is
// announced like any other.
export async function rejectUnderage(input: z.input<typeof underageSchema>): Promise<ActionResult> {
  const parsed = underageSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Неверные данные' }
  }
  const adminId = await requireAdmin()
  const { data, error } = await createAdminClient().rpc('admin_reject_underage', {
    p_admin: adminId,
    p_request: parsed.data.requestId,
  })
  if (error) {
    if (error.code === '42501') return { ok: false, error: 'Недостаточно прав для этого действия' }
    if (error.code === 'P0002') return { ok: false, error: 'Заявка уже рассмотрена' }
    return { ok: false, error: `Ошибка: ${error.message}` }
  }
  revalidatePath('/admin', 'layout')

  const out = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  const userId = typeof out.user_id === 'string' ? out.user_id : null
  const banDays = typeof out.ban_days === 'number' ? out.ban_days : null
  notifyUnderageDecided(parsed.data.requestId, adminId, banDays)
  if (userId) notifyBanChanged(adminId, userId, true, 'underage')
  const endedCalls = Array.isArray(out.ended_calls)
    ? out.ended_calls.filter((id): id is string => typeof id === 'string')
    : []
  const env = getLiveKitEnv()
  if (env && endedCalls.length)
    after(() => Promise.all(endedCalls.map((id) => closeCallRoom(env, id))))
  return { ok: true, data: undefined }
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

// One atomic RPC (20261009000161) through resolveCase: the sanction and the closing of every
// open report on the target happen in one transaction.
export async function resolveReports(input: z.input<typeof resolveSchema>) {
  return resolveCase(input)
}
