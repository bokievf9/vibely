'use server'

import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAdminAction } from './run-action'
import { noteIdSchema, noteSchema } from './sanction-schemas'

// Internal moderator notes on a user (20261009000153): the author deletes their own notes, an
// admin may delete any (the RPC decides).
export async function addNote(input: z.input<typeof noteSchema>) {
  return runAdminAction(noteSchema, input, 'moderator', async (d, admin) =>
    createAdminClient().rpc('admin_add_note', {
      p_admin: admin.id,
      p_user: d.userId,
      p_body: d.body,
    }),
  )
}

export async function deleteNote(input: z.input<typeof noteIdSchema>) {
  return runAdminAction(noteIdSchema, input, 'moderator', async (d, admin) =>
    createAdminClient().rpc('admin_delete_note', { p_admin: admin.id, p_note: d.noteId }),
  )
}
