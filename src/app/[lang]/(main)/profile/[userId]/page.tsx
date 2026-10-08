import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, MapPin, MessageCircle } from 'lucide-react'
import { VerifiedBadge } from '@/components/ui/verified-badge'
import { getViewer } from '@/features/auth/session'
import { unmatch } from '@/features/chat/actions'
import { AboutDetails, PromptCards } from '@/features/profile/components/about-details'
import { PhotoCarousel } from '@/features/profile/components/photo-carousel'
import { PublicProfileSkeleton } from '@/features/profile/components/profile-skeleton'
import { getPublicProfile } from '@/features/profile/public-profile'
import { SafetyMenu } from '@/features/safety/components/safety-menu'
import { ProfileLikeButton } from '@/features/username/components/profile-like-button'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).profile.title, robots: { index: false } }
}

export default function MatchedProfilePage({ params }: PageProps<'/[lang]/profile/[userId]'>) {
  return (
    <Suspense fallback={<PublicProfileSkeleton />}>
      <ProfileView params={params} />
    </Suspense>
  )
}

async function ProfileView({ params }: Pick<PageProps<'/[lang]/profile/[userId]'>, 'params'>) {
  const [{ userId }, viewer, locale, dict] = await Promise.all([
    params,
    getViewer(),
    getLocale(),
    getDictionary(),
  ])
  const profile =
    viewer && /^[0-9a-f-]{36}$/.test(userId) ? await getPublicProfile(userId, viewer.id) : null
  if (!profile) notFound()
  // Matched: back to the chat. Opened from people search: back to the search.
  const backHref = profile.matchId ? `/chats/${profile.matchId}` : '/search'

  return (
    <article className="flex flex-col">
      <div className="relative aspect-[3/4] w-full">
        <PhotoCarousel photos={profile.photos} alt={profile.name} priority />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] flex items-center justify-between p-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link
            href={localePath(locale, backHref)}
            aria-label={profile.matchId ? dict.common.back : dict.username.backToSearch}
            className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.94] active:bg-black/70"
          >
            <ChevronLeft className="size-6" />
          </Link>
          <div className="pointer-events-auto flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
            <SafetyMenu
              userId={profile.id}
              name={profile.name}
              onUnmatch={profile.matchId ? unmatch.bind(null, profile.matchId) : undefined}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <h1 className="text-3xl leading-tight font-bold [overflow-wrap:anywhere]">
          {profile.name}, <span className="font-normal">{profile.age}</span>
          <VerifiedBadge size={24} className="ml-1.5 align-[-0.1em]" />
        </h1>
        <p className="text-muted -mt-2 truncate">@{profile.username}</p>
        {profile.city && (
          <p className="text-muted flex min-w-0 items-center gap-1">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{profile.city}</span>
          </p>
        )}
        {profile.bio && (
          <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{profile.bio}</p>
        )}
        <PromptCards prompts={profile.prompts} t={dict.about} />
        <AboutDetails about={profile.about} t={dict.about} title={dict.about.about} />
        {profile.tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {profile.tags.map((slug) => (
              <li key={slug} className="bg-surface rounded-full px-3 py-1 text-sm">
                {dict.tags[slug] ?? slug}
              </li>
            ))}
          </ul>
        )}
        {profile.matchId ? (
          <Link
            href={localePath(locale, `/chats/${profile.matchId}`)}
            className="bg-accent text-accent-foreground mt-2 flex h-12 items-center justify-center gap-2 rounded-2xl font-semibold transition-[transform,opacity] duration-150 ease-out select-none active:scale-[0.97] active:opacity-90"
          >
            <MessageCircle className="size-5" /> {dict.swipe.sendMessage}
          </Link>
        ) : (
          profile.swiped !== 'pass' && (
            <ProfileLikeButton userId={profile.id} liked={profile.swiped === 'like'} />
          )
        )}
      </div>
    </article>
  )
}
