import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { signPhotoPaths } from '@/features/profile/queries'
import { hydrateMessages, loadReactionsFor } from './hydrate'
import { previewKindOf } from './message-kind'
import { MESSAGE_COLUMNS } from './message-row'
import { toReadReceipts } from './read-receipts'
import type { ChatPreview, Partner } from './types'

const ROOM_HISTORY = 100

type PartnerRow = {
  id: string
  display_name: string
  username: string
  profile_photos: { storage_path: string; width: number; height: number; position: number }[]
} | null

const PARTNER = 'id, display_name, username, profile_photos(storage_path, width, height, position)'

async function toPartners(rows: PartnerRow[]): Promise<Map<string, Partner>> {
  const firstPhoto = (r: NonNullable<PartnerRow>) =>
    [...r.profile_photos].sort((a, b) => a.position - b.position)[0]
  const valid = rows.filter((r): r is NonNullable<PartnerRow> => r !== null)
  const urls = await signPhotoPaths(valid.flatMap((r) => firstPhoto(r)?.storage_path ?? []))
  return new Map(
    valid.map((r) => {
      const p = firstPhoto(r)
      const url = p && urls.get(p.storage_path)
      return [
        r.id,
        {
          id: r.id,
          name: r.display_name,
          username: r.username,
          photo: url && p ? { url, width: p.width, height: p.height } : null,
        },
      ]
    }),
  )
}

// Matches with the partner's first photo and the latest message. Partners that are banned,
// blocked or deactivated are invisible through RLS, so their chats drop out automatically.
export async function getChatList(viewerId: string): Promise<ChatPreview[]> {
  const supabase = await createClient()
  const { data: matches } = await supabase
    .from('matches')
    .select(
      `id, created_at, a:profiles!matches_user_a_fkey(${PARTNER}), b:profiles!matches_user_b_fkey(${PARTNER})`,
    )
    .order('created_at', { ascending: false })
  if (!matches?.length) return []

  const partnerRows = matches.map((m) => (m.a?.id === viewerId ? m.b : m.a))
  const [partners, { data: messages }, reads] = await Promise.all([
    toPartners(partnerRows),
    supabase
      .from('messages')
      .select(
        'match_id, body, sender_id, created_at, read_at, media_kind, media_expired_at, deleted_at',
      )
      .in(
        'match_id',
        matches.map((m) => m.id),
      )
      .order('created_at', { ascending: false })
      .limit(500),
    // The viewer's read-up-to per match (20261009000290); absent before it: read_at only.
    supabase.rpc('my_match_reads'),
  ])
  const readUpTo = new Map(
    (reads.error ? [] : (reads.data ?? [])).map((r) => [r.match_id, r.last_read_at]),
  )
  const unreadIn = (matchId: string, msg: { created_at: string; read_at: string | null }) => {
    const upTo = readUpTo.get(matchId)
    return !msg.read_at && (!upTo || Date.parse(msg.created_at) > Date.parse(upTo))
  }

  const previews = matches.flatMap((m, i) => {
    const partner = partners.get(partnerRows[i]?.id ?? '')
    if (!partner) return []
    const own = messages?.filter((msg) => msg.match_id === m.id) ?? []
    const last = own[0]
    return [
      {
        matchId: m.id,
        partner,
        lastMessage: last
          ? {
              body: last.body,
              kind: previewKindOf(last),
              mine: last.sender_id === viewerId,
              at: last.created_at,
            }
          : null,
        unread: own.filter(
          (msg) => msg.sender_id !== viewerId && !msg.deleted_at && unreadIn(m.id, msg),
        ).length,
        createdAt: m.created_at,
      },
    ]
  })
  return previews.sort((x, y) =>
    (y.lastMessage?.at ?? y.createdAt).localeCompare(x.lastMessage?.at ?? x.createdAt),
  )
}

export async function getChatRoom(matchId: string, viewerId: string) {
  const supabase = await createClient()
  const { data: match } = await supabase
    .from('matches')
    .select(
      `id, a:profiles!matches_user_a_fkey(${PARTNER}), b:profiles!matches_user_b_fkey(${PARTNER})`,
    )
    .eq('id', matchId)
    .maybeSingle()
  const row = match && (match.a?.id === viewerId ? match.b : match.a)
  if (!row) return null

  const [partners, { data: messages }, readState] = await Promise.all([
    toPartners([row]),
    supabase
      .from('messages')
      .select(MESSAGE_COLUMNS)
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(ROOM_HISTORY + 1),
    supabase.rpc('match_read_state', { p_match: matchId }),
  ])
  const partner = partners.get(row.id)
  if (!partner) return null
  const rows = messages ?? []
  const page = rows.slice(0, ROOM_HISTORY).reverse()
  const [hydrated, reactions] = await Promise.all([
    hydrateMessages(supabase, page),
    loadReactionsFor(
      supabase,
      matchId,
      page.map((m) => m.id),
    ),
  ])
  return {
    partner,
    messages: hydrated,
    reactions,
    hasMore: rows.length > ROOM_HISTORY,
    receipts: toReadReceipts(readState.data, readState.error),
  }
}
