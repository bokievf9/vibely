import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { CHAT_MEDIA_BUCKET } from '@/features/chat/types'

// Retention job (CLAUDE.md "Safety recording & data retention", 20261008000111): files older than
// 90 days go, unless an open report concerns the people involved. The SQL functions decide what is
// due; storage objects can only be removed through the Storage API, with the service role.

type Admin = ReturnType<typeof createAdminClient>

const BATCH = 100
// Per kind and run: a backlog is worked off over several daily runs instead of one long request.
const MAX_BATCHES = 20

export type RetentionReport = {
  chatMediaExpired: number
  chatMediaOrphans: number
  deletedMessages: number
  selfies: number
  liftedBans: number
}

async function removeFiles(db: Admin, bucket: string, paths: string[]): Promise<number> {
  if (!paths.length) return 0
  const { data, error } = await db.storage.from(bucket).remove(paths)
  if (error) throw new Error(`retention: remove from ${bucket} failed: ${error.message}`)
  return data.length
}

// Media of messages older than 90 days: remove the file, then turn the message into an
// "expired" placeholder (only for files that are really gone).
async function expireChatMedia(db: Admin): Promise<number> {
  let expired = 0
  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await db.rpc('retention_chat_media', { p_limit: BATCH })
    if (error) throw new Error(`retention: list chat media failed: ${error.message}`)
    if (!data.length) break
    await removeFiles(
      db,
      CHAT_MEDIA_BUCKET,
      data.map((d) => d.path),
    )
    const { data: marked, error: markError } = await db.rpc('retention_mark_chat_media_expired', {
      p_ids: data.map((d) => d.message_id),
    })
    if (markError) throw new Error(`retention: mark expired failed: ${markError.message}`)
    expired += marked
    // No progress (files could not be removed): stop instead of looping on the same rows.
    if (!marked || data.length < BATCH) break
  }
  return expired
}

// Lists due paths with `rpc` and removes them until nothing is left (or no progress is made).
async function purgeListed(
  db: Admin,
  bucket: string,
  rpc: 'retention_orphan_chat_media' | 'retention_selfies',
): Promise<number> {
  let removed = 0
  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await db.rpc(rpc, { p_limit: BATCH })
    if (error) throw new Error(`retention: ${rpc} failed: ${error.message}`)
    const count = await removeFiles(db, bucket, data)
    removed += count
    if (!count || data.length < BATCH) break
  }
  return removed
}

// "Deleted for everyone" messages archived for moderators (20261008000131): after 90 days remove
// the archived file (if any), then the archive row.
async function purgeDeletedMessages(db: Admin): Promise<number> {
  let purged = 0
  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await db.rpc('retention_message_deletions', { p_limit: BATCH })
    if (error) throw new Error(`retention: list deleted messages failed: ${error.message}`)
    if (!data.length) break
    await removeFiles(
      db,
      CHAT_MEDIA_BUCKET,
      data.flatMap((d) => (d.media_path ? [d.media_path] : [])),
    )
    const { data: dropped, error: dropError } = await db.rpc('retention_drop_message_deletions', {
      p_ids: data.map((d) => d.message_id),
    })
    if (dropError) throw new Error(`retention: drop deleted messages failed: ${dropError.message}`)
    purged += dropped
    if (!dropped || data.length < BATCH) break
  }
  return purged
}

export async function runRetention(): Promise<RetentionReport> {
  const db = createAdminClient()
  // Backstop for pg_cron (20261009000151): lift temporary bans and mutes that have expired.
  const { data: liftedBans, error: liftError } = await db.rpc('lift_expired_sanctions')
  if (liftError) throw new Error(`retention: lift sanctions failed: ${liftError.message}`)
  const chatMediaExpired = await expireChatMedia(db)
  const chatMediaOrphans = await purgeListed(db, CHAT_MEDIA_BUCKET, 'retention_orphan_chat_media')
  const deletedMessages = await purgeDeletedMessages(db)
  const selfies = await purgeListed(db, 'selfies', 'retention_selfies')
  return { chatMediaExpired, chatMediaOrphans, deletedMessages, selfies, liftedBans }
}
