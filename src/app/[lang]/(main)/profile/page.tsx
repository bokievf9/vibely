import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Pencil, Settings } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { getViewer } from '@/features/auth/session'
import { PhotoUploader } from '@/features/profile/components/photo-uploader'
import { CompletenessNudge } from '@/features/profile/components/completeness-nudge'
import { OwnProfileHeader } from '@/features/profile/components/own-profile-header'
import { ProfilePreview } from '@/features/profile/components/profile-preview'
import { OwnProfileSkeleton } from '@/features/profile/components/profile-skeleton'
import { ownCandidate } from '@/features/profile/own-card'
import { getOwnPhotos, getOwnProfile, getTags } from '@/features/profile/queries'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).profile.title }
}

export default async function ProfilePage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()])
  return (
    <>
      <PageHeader title={dict.profile.title}>
        <Link
          href={localePath(locale, '/settings')}
          aria-label={dict.settings.open}
          className="active:bg-surface flex size-12 items-center justify-center rounded-2xl transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.94]"
        >
          <Settings className="size-6" />
        </Link>
      </PageHeader>
      <Suspense fallback={<OwnProfileSkeleton />}>
        <OwnProfile />
      </Suspense>
    </>
  )
}

async function OwnProfile() {
  const [viewer, locale, dict] = await Promise.all([getViewer(), getLocale(), getDictionary()])
  if (!viewer?.profile) return null
  const [photos, profile, tags] = await Promise.all([
    getOwnPhotos(viewer.id),
    getOwnProfile(viewer.id),
    getTags(),
  ])
  const card = profile && ownCandidate(viewer.id, profile, photos, tags)

  return (
    <div className="flex flex-col gap-8 px-4 pb-6">
      <section className="flex flex-col gap-3">
        <OwnProfileHeader
          name={viewer.profile.displayName}
          username={viewer.profile.username}
          age={card?.age ?? null}
          city={profile?.city ?? ''}
          verified={viewer.profile.verificationStatus === 'approved'}
          mainPhoto={photos[0] ?? null}
          t={dict.avatar}
        />
        <Link
          href={localePath(locale, '/profile/edit')}
          className="bg-surface border-border active:bg-border flex h-12 items-center justify-center gap-2 rounded-2xl border font-semibold transition-[transform,scale,background-color] duration-150 ease-out select-none active:scale-[0.98]"
        >
          <Pencil className="size-5" /> {dict.profile.edit}
        </Link>
        {card && <ProfilePreview candidate={card} />}
      </section>
      {profile && (
        <CompletenessNudge
          profile={profile}
          photoCount={photos.length}
          locale={locale}
          t={dict.about}
        />
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-muted text-sm font-medium">{dict.profile.photos}</h2>
        <PhotoUploader userId={viewer.id} photos={photos} />
      </section>
    </div>
  )
}
