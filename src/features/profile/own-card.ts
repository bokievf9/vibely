import type { Candidate } from '@/features/swipe/schemas'
import { ageFromBirthDate } from '@/lib/utils'
import type { OwnPhoto, OwnProfile, Tag } from './queries'

// The viewer's own data in the shape of a swipe card, for the "How others see me" preview.
// Distance is relative to the viewer, so it is left out.
export function ownCandidate(
  id: string,
  profile: OwnProfile,
  photos: OwnPhoto[],
  tags: Tag[],
): Candidate {
  const slugById = new Map(tags.map((t) => [t.id, t.slug]))
  return {
    id,
    name: profile.displayName,
    age: ageFromBirthDate(profile.birthDate),
    bio: profile.bio || null,
    city: profile.city || null,
    distanceKm: null,
    secondChance: false,
    tags: profile.tagIds.flatMap((tagId) => slugById.get(tagId) ?? []).sort(),
    photos: [...photos]
      .sort((a, b) => a.position - b.position)
      .map(({ url, width, height }) => ({ url, width, height })),
    about: profile.about,
    prompts: profile.prompts,
  }
}
