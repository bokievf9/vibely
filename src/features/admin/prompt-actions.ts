'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/types/action-result'
import { promptSchema, type PromptInput } from './prompt-schemas'
import { runAdminAction } from './run-action'

// /admin/prompts (20261009000220): add / edit, reorder and delete questions of the day. The RPCs
// check the role again and log to moderation_actions.
export async function savePrompt(input: PromptInput): Promise<ActionResult<string>> {
  return runAdminAction(promptSchema, input, 'moderator', async (data, admin) => {
    const { data: id, error } = await createAdminClient().rpc('admin_upsert_daily_prompt', {
      p_admin: admin.id,
      p_question: data.question,
      p_options: data.options,
      p_id: data.id,
    })
    return { error, data: id ?? '' }
  })
}

const idSchema = z.object({ id: z.uuid() })

export async function deletePrompt(input: { id: string }): Promise<ActionResult> {
  return runAdminAction(idSchema, input, 'moderator', async ({ id }, admin) => {
    const { error } = await createAdminClient().rpc('admin_delete_daily_prompt', {
      p_admin: admin.id,
      p_id: id,
    })
    return { error }
  })
}

const moveSchema = idSchema.extend({ up: z.boolean() })

export async function movePrompt(input: { id: string; up: boolean }): Promise<ActionResult> {
  return runAdminAction(moveSchema, input, 'moderator', async ({ id, up }, admin) => {
    const { error } = await createAdminClient().rpc('admin_move_daily_prompt', {
      p_admin: admin.id,
      p_id: id,
      p_up: up,
    })
    return { error }
  })
}
