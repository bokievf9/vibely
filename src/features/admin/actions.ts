'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/types/action-result'
import { requireAdmin } from './guard'
import { readableBan } from './labels'
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
  if (result.ok && parsed.success) await deleteReviewedSelfie(parsed.data.requestId)
  return result
}

// The selfie is needed only for the review (Privacy Policy): delete the file right after it.
// The decision is already saved, so a storage error is logged rather than reported as a failure.
async function deleteReviewedSelfie(requestId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('verification_requests')
    .select('selfie_path')
    .eq('id', requestId)
    .maybeSingle()
  if (!data) return
  const { error } = await db.storage.from('selfies').remove([data.selfie_path])
  if (error) console.error('Selfie deletion failed', requestId, error.message)
}

export async function setBan(input: z.input<typeof banSchema>) {
  return moderate(banSchema, input, (d, admin) => [
    createAdminClient().rpc('admin_set_ban', {
      p_admin: admin,
      p_user: d.userId,
      p_banned: d.banned,
      p_reason: d.banned ? d.reason : undefined,
    }),
  ])
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

export async function resolveReports(input: z.input<typeof resolveSchema>) {
  return moderate(resolveSchema, input, (d, admin) => {
    const db = createAdminClient()
    const resolve = (resolution: string) =>
      db.rpc('admin_resolve_reports', {
        p_admin: admin,
        p_type: d.targetType,
        p_target: d.targetId,
        p_resolution: resolution,
      })
    switch (d.decision) {
      case 'dismiss':
        return [resolve(d.reason || 'Отклонено: нарушения нет')]
      case 'hide':
        return [
          db.rpc('admin_set_content_hidden', {
            p_admin: admin,
            p_type: d.targetType,
            p_id: d.targetId,
            p_hidden: true,
            p_reason: d.reason,
          }),
          resolve(`Контент скрыт: ${d.reason}`),
        ]
      case 'ban':
        return [
          db.rpc('admin_set_ban', {
            p_admin: admin,
            p_user: d.offenderId,
            p_banned: true,
            p_reason: d.reason,
          }),
          resolve(`Пользователь заблокирован: ${readableBan(d.reason)}`),
        ]
    }
  })
}
