import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Pencil, Settings } from 'lucide-react'
import { headerActionClassName } from '@/components/layout/header-styles'
import { PageHeader } from '@/components/layout/page-header'
import { getViewer } from '@/features/auth/session'
import { PhotoUploader } from '@/features/profile/components/photo-uploader'
import { CompletenessNudge } from '@/features/profile/components/completeness-nudge'
import { OwnProfileHeader } from '@/features/profile/components/own-profile-header'
import { ProfilePreview } from '@/features/profile/components/profile-preview'
import { groupedRowClassName } from '@/components/ui/grouped'
import { OwnProfileSkeleton } from '@/features/profile/components/profile-skeleton'
import { ownCandidate } from '@/features/profile/own-card'
import { getOwnPhotos, getOwnProfile, getTags } from '@/features/profile/queries'
import { getVipStatus } from '@/features/promo/queries'
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
          className={headerActionClassName}
        >
          <Settings className="size-[1.375rem]" />
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
  const [photos, profile, tags, vip] = await Promise.all([
    getOwnPhotos(viewer.id),
    getOwnProfile(viewer.id),
    getTags(),
    getVipStatus(),
  ])
  const card = profile && { ...ownCandidate(viewer.id, profile, photos, tags), vip: vip?.isVip }

  return (
    <div className="flex flex-col gap-7 px-4 pb-8">
      <section className="flex flex-col gap-6">
        <OwnProfileHeader
          name={viewer.profile.displayName}
          username={viewer.profile.username}
          age={card?.age ?? null}
          city={profile?.city ?? ''}
          verified={viewer.profile.verificationStatus === 'approved'}
          vip={vip?.isVip ?? false}
          mainPhoto={photos[0] ?? null}
          t={dict.avatar}
        />
        {/* Grouped list, iOS Settings style. */}
        <div className="card divide-border flex flex-col divide-y overflow-hidden">
          <Link href={localePath(locale, '/profile/edit')} className={groupedRowClassName}>
            <span className="icon-tile">
              <Pencil className="size-[1.125rem]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate">{dict.profile.edit}</span>
            <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
          </Link>
          {card && <ProfilePreview candidate={card} />}
        </div>
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
        <h2 className="text-headline px-1">{dict.profile.photos}</h2>
        <PhotoUploader userId={viewer.id} photos={photos} />
      </section>
    </div>
  )
}
