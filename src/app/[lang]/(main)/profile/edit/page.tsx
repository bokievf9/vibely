import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { PageSpinner } from '@/components/ui/spinner'
import { getViewer } from '@/features/auth/session'
import { ProfileForm } from '@/features/profile/components/profile-form'
import { getOwnProfile, getTags } from '@/features/profile/queries'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).profile.editTitle }
}

export default async function EditProfilePage() {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader title={dict.profile.editTitle} />
      <Suspense fallback={<PageSpinner />}>
        <Edit />
      </Suspense>
    </>
  )
}

async function Edit() {
  const viewer = await getViewer()
  const [profile, tags] = await Promise.all([viewer ? getOwnProfile(viewer.id) : null, getTags()])
  if (!profile) return null
  return (
    <div className="px-4 pb-6">
      <ProfileForm tags={tags} initial={profile} />
    </div>
  )
}
