'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { WAITLIST_STATUSES } from './queries/waitlist'
import { runAdminAction } from './run-action'

const csvCell = (v: string | null) => {
  const s = v ?? ''
  // Quotes always; a leading = + - @ is neutralised so spreadsheets don't run it as a formula.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${safe.replaceAll('"', '""')}"`
}

// CSV with full numbers (admin and owner). admin_waitlist_export logs export.waitlist with the
// row count before it returns anything. Phone numbers start with "+", which the CSV keeps as
// text ("'+60..."), so spreadsheets do not turn them into numbers or formulas.
export async function exportWaitlist(input: unknown) {
  return runAdminAction(
    z.object({ status: z.enum(WAITLIST_STATUSES) }),
    input,
    'admin',
    async ({ status }, admin) => {
      const { data, error } = await createAdminClient().rpc('admin_waitlist_export', {
        p_admin: admin.id,
        p_status: status,
      })
      if (error) return { error }
      const header = [
        'phone',
        'city',
        'locale',
        'source',
        'consent_at',
        'created_at',
        'invited_at',
        'id',
      ]
      const lines = data.map((r) =>
        [r.phone, r.city, r.locale, r.source, r.consent_at, r.created_at, r.invited_at, r.id]
          .map(csvCell)
          .join(','),
      )
      return {
        error: null,
        data: {
          filename: `vibely-waitlist-${status}-${new Date().toISOString().slice(0, 10)}.csv`,
          csv: '﻿' + [header.join(','), ...lines].join('\r\n'),
        },
      }
    },
  )
}

// After the invite SMS went out (admin and owner). Logged per entry as waitlist.invite.
export async function markWaitlistInvited(input: unknown) {
  return runAdminAction(
    z.object({ ids: z.array(z.uuid()).min(1).max(500) }),
    input,
    'admin',
    async ({ ids }, admin) => {
      const { data, error } = await createAdminClient().rpc('admin_waitlist_mark_invited', {
        p_admin: admin.id,
        p_ids: ids,
      })
      return { error, data: data ?? 0 }
    },
  )
}
