'use server'

import { after } from 'next/server'
import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLiveKitEnv } from '@/features/calls/server/env'
import { closeCallRoom } from '@/features/calls/server/livekit'
import { MODERATOR_MAX_BAN_DAYS } from './roles'
import { runAdminAction } from './run-action'
import {
  banUserSchema,
  exportSchema,
  flagSchema,
  holdSchema,
  muteSchema,
  revokeWarningSchema,
  unbanSchema,
  userIdSchema,
  warnSchema,
} from './sanction-schemas'

// Sanctions on one user (/admin/users/[id]). Every RPC checks the role and logs the decision in
// moderation_actions (20261009000151).

export async function warnUser(input: z.input<typeof warnSchema>) {
  return runAdminAction(warnSchema, input, 'moderator', async (d, admin) =>
    createAdminClient().rpc('admin_warn_user', {
      p_admin: admin.id,
      p_user: d.userId,
      p_reason: d.reason,
      p_note: d.note || undefined,
      p_days: d.days,
    }),
  )
}

export async function revokeWarning(input: z.input<typeof revokeWarningSchema>) {
  return runAdminAction(revokeWarningSchema, input, 'moderator', async (d, admin) =>
    createAdminClient().rpc('admin_revoke_warning', {
      p_admin: admin.id,
      p_warning: d.warningId,
      p_reason: d.reason || undefined,
    }),
  )
}

export async function setMute(input: z.input<typeof muteSchema>) {
  return runAdminAction(muteSchema, input, 'moderator', async (d, admin) =>
    createAdminClient().rpc('admin_set_mute', {
      p_admin: admin.id,
      p_user: d.userId,
      p_hours: d.mute ? d.hours : 0,
      p_reason: d.mute ? d.reason : undefined,
    }),
  )
}

// Bans (temporary up to 7 days: moderator; longer, permanent or with the phone blocked: admin).
// The RPC ends the user's random chats and live calls and deletes their auth sessions (every
// device is signed out once its access token expires); here we also close the calls' LiveKit
// rooms so the media stops at once.
export async function banUser(input: z.input<typeof banUserSchema>) {
  const parsed = banUserSchema.safeParse(input)
  const min =
    parsed.success &&
    !parsed.data.blockPhone &&
    parsed.data.days !== null &&
    parsed.data.days <= MODERATOR_MAX_BAN_DAYS
      ? 'moderator'
      : 'admin'
  return runAdminAction(banUserSchema, input, min, async (d, admin) => {
    const db = createAdminClient()
    const { data: endedCalls, error } = await db.rpc('admin_ban_user', {
      p_admin: admin.id,
      p_user: d.userId,
      p_reason: d.reason,
      p_days: d.days ?? undefined,
    })
    if (error) return { error }
    const env = getLiveKitEnv()
    if (env && endedCalls?.length) {
      after(() => Promise.all(endedCalls.map((id) => closeCallRoom(env, id))))
    }
    if (d.blockPhone) {
      const { error: blockError } = await db.rpc('admin_block_phone', {
        p_admin: admin.id,
        p_phone: '',
        p_user: d.userId,
        p_reason: `Бан: ${d.reason}`,
      })
      if (blockError) {
        return {
          error: {
            message: `пользователь заблокирован, но номер не добавлен: ${blockError.message}`,
          },
        }
      }
    }
    return { error: null }
  })
}

export async function unbanUser(input: z.input<typeof unbanSchema>) {
  return runAdminAction(unbanSchema, input, 'admin', async (d, admin) =>
    createAdminClient().rpc('admin_unban_user', {
      p_admin: admin.id,
      p_user: d.userId,
      p_reason: d.reason || undefined,
    }),
  )
}

export async function setShadowBan(input: z.input<typeof flagSchema>) {
  return runAdminAction(flagSchema, input, 'admin', async (d, admin) =>
    createAdminClient().rpc('admin_set_shadow_ban', {
      p_admin: admin.id,
      p_user: d.userId,
      p_on: d.on,
      p_reason: d.reason || undefined,
    }),
  )
}

export async function setEvidenceHold(input: z.input<typeof holdSchema>) {
  return runAdminAction(holdSchema, input, 'admin', async (d, admin) =>
    createAdminClient().rpc('admin_set_evidence_hold', {
      p_admin: admin.id,
      p_user: d.userId,
      p_on: d.on,
      p_reason: d.reason || undefined,
    }),
  )
}

// The phone number is shown on demand only; every reveal is logged (view.phone).
export async function revealPhone(input: z.input<typeof userIdSchema>) {
  return runAdminAction(userIdSchema, input, 'moderator', async (d, admin) => {
    const { data, error } = await createAdminClient().rpc('admin_get_phone', {
      p_admin: admin.id,
      p_user: d.userId,
    })
    return { error, data: data ? `+${data}` : 'нет телефона' }
  })
}

// Owner only: everything about the user as JSON for a legal request (logged with the reference).
export async function exportUserData(input: z.input<typeof exportSchema>) {
  return runAdminAction(exportSchema, input, 'owner', async (d, admin) => {
    const { data, error } = await createAdminClient().rpc('admin_export_user', {
      p_admin: admin.id,
      p_user: d.userId,
      p_reference: d.reference,
    })
    return {
      error,
      data: {
        filename: `vibely-user-${d.userId}-${new Date().toISOString().slice(0, 10)}.json`,
        json: JSON.stringify(data, null, 2),
      },
    }
  })
}
