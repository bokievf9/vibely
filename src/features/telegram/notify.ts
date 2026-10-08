import 'server-only'
import type { Enums } from '@/types/database.types'
import { readableRejection } from '@/features/admin/labels'
import type { REPORT_REASONS } from '@/features/safety/schemas'
import { runAfter } from './client'
import { moderatorName } from './moderation'
import { closeReport, postBanChange, postReport } from './reports'
import { closeSelfie, postSelfie } from './selfies'

// Hooks called from server actions. All fire-and-forget after the response: they never throw
// into the caller and do nothing when the bot is not configured.

export function notifySelfieSubmitted(userId?: string) {
  if (!userId) return
  runAfter('selfie', () => postSelfie(userId))
}

// The reason category is the only report detail that reaches Telegram (the free text, the
// reporter and any content stay in the panel).
export function notifyReportCreated(
  targetType: Enums<'report_target'>,
  _reason: (typeof REPORT_REASONS)[number],
  targetId?: string,
) {
  if (!targetId) return
  runAfter('report', () => postReport(targetType, targetId))
}

// Decisions taken in the admin panel: the Telegram copy shows who decided and the selfie photos
// leave the chat.
export function notifyVerificationDecided(
  requestId: string,
  adminId: string,
  approve: boolean,
  reason?: string,
) {
  runAfter('selfie decided', async () => {
    const who = await moderatorName(adminId)
    await closeSelfie(
      requestId,
      approve
        ? `📸 Селфи\n✅ Одобрено в админке: ${who}`
        : `📸 Селфи\n❌ Отклонено в админке (${readableRejection(reason ?? '')}): ${who}`,
    )
  })
}

export function notifyReportsResolved(
  targetType: Enums<'report_target'>,
  targetId: string,
  adminId: string,
  outcome: string,
) {
  runAfter('report resolved', async () => {
    await closeReport(
      targetType,
      targetId,
      `${outcome} (в админке): ${await moderatorName(adminId)}`,
    )
  })
}

export function notifyBanChanged(
  adminId: string,
  userId: string,
  banned: boolean,
  reason?: string,
) {
  runAfter('ban', async () => {
    await postBanChange({ moderator: await moderatorName(adminId), userId, banned, reason })
  })
}
