'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { actionLabel } from './log-labels'
import { getLogForExport, logFilterSchema } from './queries/log'
import { runAdminAction } from './run-action'

const csvCell = (v: string | null) => {
  const s = v ?? ''
  // Quotes always; a leading = + - @ is neutralised so spreadsheets don't run it as a formula.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${safe.replaceAll('"', '""')}"`
}

// CSV of the journal with the current filters (admin and owner). The export itself is logged
// (export.audit_log) with the filters as the reason, before the data is read.
export async function exportAuditLog(input: unknown) {
  return runAdminAction(logFilterSchema, input, 'admin', async (filters, admin) => {
    const rest = { ...filters, page: undefined }
    const { error } = await createAdminClient().rpc('admin_log_access', {
      p_admin: admin.id,
      p_action: 'export.audit_log',
      p_type: 'audit_log',
      p_targets: [admin.id],
      p_reason: JSON.stringify(rest),
    })
    if (error) return { error }
    const entries = await getLogForExport(rest)
    const header = [
      'created_at',
      'moderator',
      'moderator_id',
      'action',
      'action_label',
      'target_type',
      'target_id',
      'reason',
    ]
    const lines = entries.map((e) =>
      [
        e.createdAt,
        e.adminName,
        e.adminId,
        e.action,
        actionLabel(e.action),
        e.targetType,
        e.targetId,
        e.reason,
      ]
        .map(csvCell)
        .join(','),
    )
    return {
      error: null,
      data: {
        filename: `vibely-moderation-log-${new Date().toISOString().slice(0, 10)}.csv`,
        // BOM so Excel opens the Cyrillic text as UTF-8.
        csv: '﻿' + [header.join(','), ...lines].join('\r\n'),
      },
    }
  })
}
