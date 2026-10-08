import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { ageFromBirthDate } from '@/lib/utils'
import type { Database, Enums } from '@/types/database.types'
import {
  aboutFromRow,
  promptsFromRows,
  type AboutInput,
  type ProfilePrompt,
} from '@/features/profile/about-schemas'
import { requireAdmin } from '../guard'
import { signProfilePhotos, signUrls, type SignedPhoto } from './storage'

export type UserRow = Database['public']['Functions']['admin_find_users']['Returns'][number]

export async function findUsers(query: string): Promise<UserRow[]> {
  const adminId = await requireAdmin()
  const { data } = await createAdminClient().rpc('admin_find_users', {
    p_admin: adminId,
    p_query: query.slice(0, 100),
    p_limit: 100,
  })
  return data ?? []
}

export type UserDetail = {
  id: string
  phone: string | null
  displayName: string
  username: string
  age: number
  gender: Enums<'gender'>
  city: string | null
  bio: string | null
  about: AboutInput
  prompts: ProfilePrompt[]
  verificationStatus: Enums<'verification_status'>
  bannedAt: string | null
  banReason: string | null
  createdAt: string
  lastActiveAt: string
  photos: SignedPhoto[]
  verifications: {
    id: string
    status: Enums<'verification_status'>
    selfieUrl: string | null
    rejectionReason: string | null
    createdAt: string
  }[]
  reportsAgainst: { reason: string; createdAt: string; resolvedAt: string | null }[]
  postCount: number
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  await requireAdmin()
  const db = createAdminClient()
  const { data: p } = await db
    .from('profiles')
    .select(
      '*, profile_photos(storage_path, width, height, position), profile_prompts(prompt_key, answer, position)',
    )
    .eq('id', userId)
    .maybeSingle()
  if (!p) return null

  const [auth, verifications, reports, posts] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db
      .from('verification_requests')
      .select('id, status, selfie_path, rejection_reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    db
      .from('reports')
      .select('reason, created_at, resolved_at')
      .eq('target_type', 'user')
      .eq('target_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    db.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
  ])
  const selfies = await signUrls('selfies', verifications.data?.map((v) => v.selfie_path) ?? [])

  return {
    id: p.id,
    phone: auth.data.user?.phone ? `+${auth.data.user.phone}` : null,
    displayName: p.display_name,
    username: p.username,
    age: ageFromBirthDate(p.birth_date),
    gender: p.gender,
    city: p.city,
    bio: p.bio,
    about: aboutFromRow(p),
    prompts: promptsFromRows(p.profile_prompts),
    verificationStatus: p.verification_status,
    bannedAt: p.banned_at,
    banReason: p.ban_reason,
    createdAt: p.created_at,
    lastActiveAt: p.last_active_at,
    photos: await signProfilePhotos([...p.profile_photos].sort((a, b) => a.position - b.position)),
    verifications: (verifications.data ?? []).map((v) => ({
      id: v.id,
      status: v.status,
      selfieUrl: selfies.get(v.selfie_path) ?? null,
      rejectionReason: v.rejection_reason,
      createdAt: v.created_at,
    })),
    reportsAgainst: (reports.data ?? []).map((r) => ({
      reason: r.reason,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
    })),
    postCount: posts.count ?? 0,
  }
}
