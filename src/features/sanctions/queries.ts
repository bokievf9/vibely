import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type MySanctions = {
  mutedUntil: string | null
  muteReason: string | null
  warnings: { id: string; reason: string; expiresAt: string }[]
}

// What the signed-in user must be told about (my_sanctions, 20261009000151).
export async function getMySanctions(): Promise<MySanctions | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_sanctions')
  if (error || !data) return null
  const raw = data as {
    muted_until: string | null
    mute_reason: string | null
    warnings: { id: string; reason: string; expires_at: string }[]
  }
  return {
    mutedUntil: raw.muted_until,
    muteReason: raw.mute_reason,
    warnings: raw.warnings.map((w) => ({ id: w.id, reason: w.reason, expiresAt: w.expires_at })),
  }
}

export type MyAppeal = { status: 'open' | 'accepted' | 'rejected'; createdAt: string } | null

export async function getMyAppeal(): Promise<MyAppeal> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('my_appeal')
  const a = data?.[0]
  if (!a) return null
  return { status: a.status as 'open' | 'accepted' | 'rejected', createdAt: a.created_at }
}
