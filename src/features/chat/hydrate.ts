import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import {
  MESSAGE_COLUMNS,
  REACTION_COLUMNS,
  toChatMessage,
  toReactions,
  type MessageRow,
} from './message-row'
import { CHAT_MEDIA_BUCKET, type ChatMessage, type Reaction, type ReplyPreview } from './types'

type Client = Awaited<ReturnType<typeof createClient>>

const SIGNED_URL_TTL_S = 60 * 60

// Signed URLs for chat photos, created with the user's own client: storage RLS only lets match
// participants read the match folder.
export async function signChatPaths(supabase: Client, paths: string[]) {
  if (!paths.length) return new Map<string, string>()
  const { data } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_S)
  return new Map(
    (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])),
  )
}

const toPreview = (m: MessageRow): ReplyPreview => ({
  id: m.id,
  senderId: m.sender_id,
  body: m.body,
  hasImage: !!m.image_path,
  deleted: !!m.deleted_at,
})

// Rows → messages with signed photo URLs and previews of quoted messages outside the page.
export async function hydrateMessages(
  supabase: Client,
  rows: MessageRow[],
): Promise<ChatMessage[]> {
  const ids = new Set(rows.map((r) => r.id))
  const missing = [
    ...new Set(rows.flatMap((r) => (r.reply_to && !ids.has(r.reply_to) ? [r.reply_to] : []))),
  ]
  const [urls, quoted] = await Promise.all([
    signChatPaths(
      supabase,
      rows.flatMap((r) => r.image_path ?? []),
    ),
    missing.length
      ? supabase.from('messages').select(MESSAGE_COLUMNS).in('id', missing)
      : Promise.resolve({ data: [] as MessageRow[] }),
  ])
  const previews = new Map([...rows, ...(quoted.data ?? [])].map((r) => [r.id, toPreview(r)]))
  return rows.map((r) => {
    const m = toChatMessage(r)
    return {
      ...m,
      image: m.image && { ...m.image, url: urls.get(m.image.path) ?? null },
      reply: (r.reply_to && previews.get(r.reply_to)) || null,
    }
  })
}

// Current reactions on the given messages (removed ones have emoji null and are skipped).
export async function loadReactionsFor(
  supabase: Client,
  matchId: string,
  messageIds: string[],
): Promise<Reaction[]> {
  if (!messageIds.length) return []
  const { data } = await supabase
    .from('message_reactions')
    .select(REACTION_COLUMNS)
    .eq('match_id', matchId)
    .in('message_id', messageIds)
    .not('emoji', 'is', null)
  return toReactions(data ?? [])
}
