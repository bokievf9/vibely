'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { signPhotoPaths } from '@/features/profile/queries'
import { usernameErrorKey } from './errors'
import {
  isValidUsername,
  normalizeUsername,
  searchQuerySchema,
  usernameSchema,
  type SearchResult,
  type UsernameStatus,
} from './schemas'

const STATUSES = ['ok', 'current', 'invalid', 'reserved', 'taken'] as const

// Live availability check for the username field (onboarding and settings).
export async function checkUsername(value: string): Promise<UserResult<UsernameStatus>> {
  const input = z.string().max(40).safeParse(value)
  if (!input.success || !isValidUsername(input.data)) return ok('invalid')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('username_status', {
    p_username: normalizeUsername(input.data),
  })
  if (error) return fail('generic')
  const status = z.enum(STATUSES).safeParse(data)
  return status.success ? ok(status.data) : fail('generic')
}

// A free username derived from the name typed in onboarding.
export async function suggestUsername(name: string): Promise<UserResult<string>> {
  const input = z.string().trim().min(1).max(40).safeParse(name)
  if (!input.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('suggest_username', { p_name: input.data })
  return error || !data ? fail('generic') : ok(data)
}

// Settings: the database enforces the format, reserved names and the 30-day cooldown.
export async function changeUsername(value: string): Promise<UserResult<string>> {
  const parsed = usernameSchema.safeParse(value)
  if (!parsed.success) return fail('usernameInvalid')
  const viewer = await getViewer()
  if (!viewer?.profile) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('set_username', { p_username: parsed.data })
  if (error) return fail(usernameErrorKey(error) ?? 'generic')
  return ok(data)
}

// Settings → Privacy: "Find me by username".
export async function setSearchable(searchable: boolean): Promise<UserResult> {
  const value = z.boolean().safeParse(searchable)
  if (!value.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ searchable_by_username: value.data })
    .eq('id', viewer.id)
  return error ? fail('generic') : ok(undefined)
}

const storedPhoto = z.object({ path: z.string(), width: z.number(), height: z.number() }).nullable()

// People search. The RPC only returns verified, active, discoverable and searchable profiles the
// caller may see, so their photos can be signed with the caller's own client.
export async function searchPeople(query: string): Promise<UserResult<SearchResult[]>> {
  const q = searchQuerySchema.safeParse(query)
  if (!q.success) return ok([])
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('search_profiles_by_username', {
    q: q.data,
    lim: 30,
  })
  if (error) return fail(error.code === '42501' ? 'unauthorized' : 'generic')

  const photos = new Map(data.map((r) => [r.id, storedPhoto.catch(null).parse(r.photo)]))
  const urls = await signPhotoPaths([...photos.values()].flatMap((p) => (p ? [p.path] : [])))
  return ok(
    data.map((r) => {
      const photo = photos.get(r.id)
      const url = photo && urls.get(photo.path)
      return {
        id: r.id,
        username: r.username,
        name: r.display_name,
        age: r.age,
        city: r.city,
        photo: photo && url ? { url, width: photo.width, height: photo.height } : null,
      }
    }),
  )
}
