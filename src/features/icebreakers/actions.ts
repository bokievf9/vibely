'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { promptsFromRows } from '@/features/profile/about-schemas'
import type { IcebreakerFacts } from './build'

const slugs = (rows: { tags: { slug: string } | null }[]) =>
  rows.flatMap((r) => (r.tags ? [r.tags.slug] : []))

// Facts for first-message suggestions in a match (RLS: only participants see the match row).
// Text is built on the client from templates, in the viewer's language.
export async function getIcebreakerFacts(matchId: string): Promise<UserResult<IcebreakerFacts>> {
  if (!z.uuid().safeParse(matchId).success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()

  const { data: match } = await supabase
    .from('matches')
    .select('user_a, user_b')
    .eq('id', matchId)
    .maybeSingle()
  if (!match) return fail('notFound')
  const partnerId = match.user_a === viewer.id ? match.user_b : match.user_a

  const [{ data: partner }, { data: mine }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'display_name, job_title, pets, profile_tags(tags(slug)), profile_prompts(prompt_key, answer, position)',
      )
      .eq('id', partnerId)
      .maybeSingle(),
    supabase.from('profile_tags').select('tags(slug)').eq('profile_id', viewer.id),
  ])
  if (!partner) return fail('notFound')

  const myTags = new Set(slugs(mine ?? []))
  const theirTags = slugs(partner.profile_tags).sort()
  return ok({
    seed: matchId,
    partnerName: partner.display_name,
    commonTags: theirTags.filter((s) => myTags.has(s)),
    partnerTags: theirTags.filter((s) => !myTags.has(s)),
    prompts: promptsFromRows(partner.profile_prompts),
    job: partner.job_title,
    pets: partner.pets,
  })
}
