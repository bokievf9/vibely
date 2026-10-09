import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { signPhotoPaths } from '@/features/profile/queries'
import type { IncomingNote, ProfileVisitors, SentNote } from './types'

// Everything here degrades to "not available" when the migration 20261009000290 is not applied:
// the RPC errors and the caller hides the entry. The viewer's perks come from the plans layer
// (getAccess / useAccess, src/features/plans).

const receiptsSchema = z.object({ send: z.boolean(), available: z.boolean() })

// Settings → Privacy: "Send read receipts". Null before 20261009000290.
export async function getReadReceiptsSetting(): Promise<{
  send: boolean
  available: boolean
} | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_read_receipts')
  if (error) return null
  const parsed = receiptsSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}

const visitorsSchema = z.object({
  full: z.boolean(),
  count: z.number(),
  visitors: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      age: z.number(),
      photo: z.object({ path: z.string(), width: z.number(), height: z.number() }).nullable(),
      visited_at: z.string(),
      liked: z.boolean(),
    }),
  ),
})

// "Who viewed you": the list for VIP, only the count for everybody else. Null before the
// migration (the entries are hidden then).
export async function getProfileVisitors(): Promise<ProfileVisitors | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_profile_visitors', { p_limit: 60 })
  if (error) return null
  const parsed = visitorsSchema.safeParse(data)
  if (!parsed.success) return null
  const v = parsed.data
  const urls = await signPhotoPaths(v.visitors.flatMap((x) => (x.photo ? [x.photo.path] : [])))
  return {
    full: v.full,
    count: v.count,
    visitors: v.visitors.map((x) => {
      const url = x.photo && urls.get(x.photo.path)
      return {
        id: x.id,
        name: x.name,
        age: x.age,
        photo: url && x.photo ? { url, width: x.photo.width, height: x.photo.height } : null,
        visitedAt: x.visited_at,
        liked: x.liked,
      }
    }),
  }
}

// Visible notes to the viewer from these people (null = everyone who liked them). Empty before
// the migration.
export async function getIncomingNotes(ids: string[] | null): Promise<Map<string, IncomingNote>> {
  if (ids && ids.length === 0) return new Map()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('incoming_like_notes', { p_ids: ids })
  if (error || !data) return new Map()
  return new Map(
    data.map((n) => [
      n.sender_id,
      { id: n.id, firstName: n.first_name, body: n.body, createdAt: n.created_at },
    ]),
  )
}

const sentSchema = z.object({ body: z.string(), state: z.string(), created_at: z.string() })

// The viewer's own note to this person (profile page), null when none or before the migration.
export async function getSentNote(targetId: string): Promise<SentNote | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_like_note', { p_target: targetId })
  if (error || !data) return null
  const parsed = sentSchema.safeParse(data)
  return parsed.success ? { body: parsed.data.body, held: parsed.data.state === 'held' } : null
}
