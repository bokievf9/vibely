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
// PostgREST: the function does not exist (the Duo Dating migration 20261009000261 is not applied
// yet). Those steps are skipped so the job keeps working before the migration.
const MISSING_RPC = 'PGRST202'

export type RetentionReport = {
  chatMediaExpired: number
  chatMediaOrphans: number
  deletedMessages: number
  selfies: number
  liftedBans: number
  // null: the Duo Dating functions are not deployed yet (step skipped).
  groupMediaExpired: number | null
  duoRowsPurged: number | null
  // Early access numbers 90 days after the invite (20261009000300); null before the migration.
  waitlistPurged: number | null
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

// Duo group chat photos older than 90 days (20261009000261), same as expireChatMedia. Runs
// before the orphan sweep; group photos are never orphans there.
async function expireGroupMedia(db: Admin): Promise<number | null> {
  let expired = 0
  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await db.rpc('retention_group_media', { p_limit: BATCH })
    if (error?.code === MISSING_RPC) return null
    if (error) throw new Error(`retention: list group media failed: ${error.message}`)
    if (!data.length) break
    await removeFiles(
      db,
      CHAT_MEDIA_BUCKET,
      data.map((d) => d.path),
    )
    const { data: marked, error: markError } = await db.rpc('retention_mark_group_media_expired', {
      p_ids: data.map((d) => d.message_id),
    })
    if (markError) throw new Error(`retention: mark group media failed: ${markError.message}`)
    expired += marked
    if (!marked || data.length < BATCH) break
  }
  return expired
}

// Dissolved duos, old decided likes and empty group chats (also scheduled by pg_cron).
async function purgeDuoData(db: Admin): Promise<number | null> {
  const { data, error } = await db.rpc('purge_old_duo_data')
  if (error?.code === MISSING_RPC) return null
  if (error) throw new Error(`retention: purge duo data failed: ${error.message}`)
  return data
}

// Waitlist numbers 90 days after their invite, and day-old rate-limit attempts.
async function purgeWaitlist(db: Admin): Promise<number | null> {
  const { data, error } = await db.rpc('purge_waitlist')
  if (error?.code === MISSING_RPC) return null
  if (error) throw new Error(`retention: purge waitlist failed: ${error.message}`)
  return data
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
  const groupMediaExpired = await expireGroupMedia(db)
  const chatMediaOrphans = await purgeListed(db, CHAT_MEDIA_BUCKET, 'retention_orphan_chat_media')
  const deletedMessages = await purgeDeletedMessages(db)
  const selfies = await purgeListed(db, 'selfies', 'retention_selfies')
  const duoRowsPurged = await purgeDuoData(db)
  const waitlistPurged = await purgeWaitlist(db)
  return {
    chatMediaExpired,
    chatMediaOrphans,
    deletedMessages,
    selfies,
    liftedBans,
    groupMediaExpired,
    duoRowsPurged,
    waitlistPurged,
  }
}
