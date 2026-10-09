import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, MapPin, MessageCircle } from 'lucide-react'
import { VerifiedBadge } from '@/components/ui/verified-badge'
import { VipBadge } from '@/components/ui/vip-badge'
import { getViewer } from '@/features/auth/session'
import { unmatch } from '@/features/chat/actions'
import { AboutDetails, PromptCards } from '@/features/profile/components/about-details'
import { PhotoCarousel } from '@/features/profile/components/photo-carousel'
import { PublicProfileSkeleton } from '@/features/profile/components/profile-skeleton'
import { getPublicProfile } from '@/features/profile/public-profile'
import { PlanBadge } from '@/features/plans/components/plan-badge'
import { SafetyMenu } from '@/features/safety/components/safety-menu'
import { ProfileLikeButton } from '@/features/username/components/profile-like-button'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).profile.title, robots: { index: false } }
}

export default function MatchedProfilePage({
  params,
  searchParams,
}: PageProps<'/[lang]/profile/[userId]'>) {
  return (
    <Suspense fallback={<PublicProfileSkeleton />}>
      <ProfileView params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function ProfileView({
  params,
  searchParams,
}: Pick<PageProps<'/[lang]/profile/[userId]'>, 'params' | 'searchParams'>) {
  const [{ userId }, { from }, viewer, locale, dict] = await Promise.all([
    params,
    searchParams,
    getViewer(),
    getLocale(),
    getDictionary(),
  ])
  const profile =
    viewer && /^[0-9a-f-]{36}$/.test(userId) ? await getPublicProfile(userId, viewer.id) : null
  if (!profile) notFound()
  // Matched: back to the chat. Opened from Discover (crossed paths): back to Discover.
  // Opened from people search: back to the search.
  const fromDiscover = from === 'discover'
  const backHref = profile.matchId
    ? `/chats/${profile.matchId}`
    : fromDiscover
      ? '/swipe'
      : '/search'

  return (
    <article className="flex flex-col">
      {/* Full-bleed photo; name, handle and city sit on a gradient over its lower part. */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-b-[2rem] shadow-[0_24px_48px_-28px_rgb(0_0_0/0.9)]">
        <PhotoCarousel photos={profile.photos} alt={profile.name} priority />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-1/2 bg-[linear-gradient(to_top,rgb(10_6_10/0.92)_0%,rgb(10_6_10/0.6)_40%,transparent_100%)]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] flex flex-col gap-1.5 px-5 pb-6 text-white">
          <h1 className="text-[2.125rem] leading-[1.1] font-bold tracking-[-0.03em] [overflow-wrap:anywhere] [text-shadow:0_1px_12px_rgb(0_0_0/0.35)]">
            {profile.name}, <span className="font-light text-white/90">{profile.age}</span>
            <VerifiedBadge size={26} className="ml-1.5 align-[-0.1em]" />
            {profile.vip && <VipBadge size={24} className="ml-1 align-[-0.1em]" />}
          </h1>
          <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-medium text-white/80">
            <span className="truncate">@{profile.username}</span>
            {profile.city && (
              <>
                <span aria-hidden className="size-1 shrink-0 rounded-full bg-white/50" />
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{profile.city}</span>
              </>
            )}
          </p>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] flex items-center justify-between p-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link
            href={localePath(locale, backHref)}
            aria-label={
              profile.matchId || fromDiscover ? dict.common.back : dict.username.backToSearch
            }
            className="glass-dark pointer-events-auto flex size-11 items-center justify-center rounded-full text-white transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.94] active:bg-black/70"
          >
            <ChevronLeft className="size-6" />
          </Link>
          <div className="glass-dark pointer-events-auto flex min-h-11 min-w-11 items-center justify-center rounded-full text-white">
            <SafetyMenu
              userId={profile.id}
              name={profile.name}
              onUnmatch={profile.matchId ? unmatch.bind(null, profile.matchId) : undefined}
              photos={profile.photos}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-4 pt-5 pb-8">
        {profile.plan && (
          <div className="flex px-1">
            <PlanBadge tag={profile.plan} label={dict.plans.tags[profile.plan]} />
          </div>
        )}
        {profile.bio && (
          <p className="text-body px-1 [overflow-wrap:anywhere] whitespace-pre-wrap text-white/90">
            {profile.bio}
          </p>
        )}
        <PromptCards prompts={profile.prompts} t={dict.about} />
        <AboutDetails about={profile.about} t={dict.about} title={dict.about.about} />
        {profile.tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {profile.tags.map((slug) => (
              <li
                key={slug}
                className="bg-surface-raised border-border rounded-full border px-3.5 py-1.5 text-sm font-medium shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]"
              >
                {dict.tags[slug] ?? slug}
              </li>
            ))}
          </ul>
        )}
        {profile.matchId ? (
          <Link
            href={localePath(locale, `/chats/${profile.matchId}`)}
            className="btn-accent mt-2 flex h-[3.25rem] items-center justify-center gap-2 rounded-2xl text-[17px] font-semibold transition-[transform,scale,filter] duration-150 ease-out select-none active:scale-[0.97] active:brightness-95"
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
