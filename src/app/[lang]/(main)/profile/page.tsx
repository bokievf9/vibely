import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PageSpinner } from '@/components/ui/spinner'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { getViewer } from '@/features/auth/session'
import { LanguageSwitcher } from '@/features/profile/components/language-switcher'
import { PhotoUploader } from '@/features/profile/components/photo-uploader'
import { getOwnPhotos } from '@/features/profile/queries'
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
  const photos = await getOwnPhotos(viewer.id)

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
      <section className="flex flex-col gap-3">
        <h2 className="text-muted text-sm font-medium">{dict.profile.photos}</h2>
        <PhotoUploader userId={viewer.id} photos={photos} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-muted text-sm font-medium">{dict.profile.language}</h2>
        <LanguageSwitcher />
      </section>
      <SignOutButton />
    </div>
  )
}
