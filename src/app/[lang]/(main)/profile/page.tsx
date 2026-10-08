import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PageSpinner } from '@/components/ui/spinner'
import { DeleteAccount } from '@/features/account/components/delete-account'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { getViewer } from '@/features/auth/session'
import { LanguageSwitcher } from '@/features/profile/components/language-switcher'
import { PhotoUploader } from '@/features/profile/components/photo-uploader'
import { CompletenessNudge } from '@/features/profile/components/completeness-nudge'
import { getOwnPhotos, getOwnProfile } from '@/features/profile/queries'
import { PushToggle } from '@/features/push/components/push-toggle'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).profile.title }
}

export default async function ProfilePage() {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader title={dict.profile.title} />
      <Suspense fallback={<PageSpinner />}>
        <OwnProfile />
      </Suspense>
    </>
  )
}

async function OwnProfile() {
  const [viewer, locale, dict] = await Promise.all([getViewer(), getLocale(), getDictionary()])
  if (!viewer?.profile) return null
  const [photos, profile] = await Promise.all([getOwnPhotos(viewer.id), getOwnProfile(viewer.id)])

  return (
    <div className="flex flex-col gap-8 px-4 pb-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">{viewer.profile.displayName}</h2>
        <Link
          href={localePath(locale, '/profile/edit')}
          className="bg-surface border-border flex h-12 items-center justify-center gap-2 rounded-2xl border font-semibold"
        >
          <Pencil className="size-5" /> {dict.profile.edit}
        </Link>
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
      <PushToggle />
      <section className="flex flex-col gap-3">
        <h2 className="text-muted text-sm font-medium">{dict.profile.language}</h2>
        <LanguageSwitcher />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-muted text-sm font-medium">{dict.legal.section}</h2>
        <ul className="bg-surface border-border divide-border divide-y rounded-2xl border">
          {(['terms', 'privacy'] as const).map((doc) => (
            <li key={doc}>
              <Link
                href={localePath(locale, `/${doc}`)}
                className="flex h-12 items-center justify-between px-4"
              >
                {dict.legal[doc]} <ChevronRight className="text-muted size-5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <SignOutButton />
      <DeleteAccount />
    </div>
  )
}
