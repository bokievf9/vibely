import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { localeRedirect } from '@/features/auth/redirect'
import { getViewer } from '@/features/auth/session'
import { PhotoUploader } from '@/features/profile/components/photo-uploader'
import { ProfileForm } from '@/features/profile/components/profile-form'
import { getOwnPhotos, getTags } from '@/features/profile/queries'
import { getDictionary } from '@/i18n/server'
import { StepHeader } from '../step-header'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).onboarding.profileTitle }
}

export default function OnboardingPage() {
  return (
    <section>
      <Suspense fallback={<PageSpinner />}>
        <OnboardingStep />
      </Suspense>
    </section>
  )
}

async function OnboardingStep() {
  const [viewer, dict] = await Promise.all([getViewer(), getDictionary()])
  if (!viewer) return localeRedirect('/login')

  if (!viewer.profile) {
    const tags = await getTags()
    return (
      <>
        <StepHeader
          title={dict.onboarding.profileTitle}
          subtitle={dict.onboarding.profileSubtitle}
        />
        <ProfileForm tags={tags} />
      </>
    )
  }

  const photos = await getOwnPhotos(viewer.id)
  return (
    <>
      <StepHeader title={dict.onboarding.photosTitle} subtitle={dict.onboarding.photosSubtitle} />
      <PhotoUploader userId={viewer.id} photos={photos} nextHref="/selfie-verification" />
    </>
  )
}
