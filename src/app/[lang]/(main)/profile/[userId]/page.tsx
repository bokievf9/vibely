import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, MapPin, MessageCircle } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { getViewer } from '@/features/auth/session'
import { unmatch } from '@/features/chat/actions'
import { PhotoCarousel } from '@/features/profile/components/photo-carousel'
import { getMatchedProfile } from '@/features/profile/public-profile'
import { SafetyMenu } from '@/features/safety/components/safety-menu'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).profile.title, robots: { index: false } }
}

export default function MatchedProfilePage({ params }: PageProps<'/[lang]/profile/[userId]'>) {
  return (
    <Suspense fallback={<PageSpinner />}>
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
    viewer && /^[0-9a-f-]{36}$/.test(userId) ? await getMatchedProfile(userId, viewer.id) : null
  if (!profile) notFound()

  return (
    <article className="flex flex-col">
      <div className="relative aspect-[3/4] w-full">
        <PhotoCarousel photos={profile.photos} alt={profile.name} priority />
        <div className="absolute inset-x-0 top-0 flex justify-between p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <Link
            href={localePath(locale, `/chats/${profile.matchId}`)}
            aria-label={dict.common.back}
            className="rounded-full bg-black/50 p-2 text-white"
          >
            <ChevronLeft className="size-6" />
          </Link>
          <div className="rounded-full bg-black/50 text-white">
            <SafetyMenu
              userId={profile.id}
              name={profile.name}
              onUnmatch={unmatch.bind(null, profile.matchId)}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <h1 className="text-3xl font-bold">
          {profile.name}, <span className="font-normal">{profile.age}</span>
        </h1>
        {profile.city && (
          <p className="text-muted flex items-center gap-1">
            <MapPin className="size-4" aria-hidden />
            {profile.city}
          </p>
        )}
        {profile.bio && <p className="whitespace-pre-wrap">{profile.bio}</p>}
        {profile.tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {profile.tags.map((slug) => (
              <li key={slug} className="bg-surface rounded-full px-3 py-1 text-sm">
                {dict.tags[slug] ?? slug}
              </li>
            ))}
          </ul>
        )}
        <Link
          href={localePath(locale, `/chats/${profile.matchId}`)}
          className="bg-accent text-accent-foreground mt-2 flex h-12 items-center justify-center gap-2 rounded-2xl font-semibold"
        >
          <MessageCircle className="size-5" /> {dict.swipe.sendMessage}
        </Link>
      </div>
    </article>
  )
}
