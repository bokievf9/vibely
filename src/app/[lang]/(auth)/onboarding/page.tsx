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

// Sticky Continue bar for both steps: the profile form's submit (last child of the form) and the
// photo step's Continue (last child of the uploader). The forms belong to the profile feature, so
// the bar is applied from here; the background-colored shadow is the bar the content scrolls under.
// TODO: a `stickyAction` prop on ProfileForm / PhotoUploader would replace these selectors.
const STICKY_CONTINUE = [
  '[&_form>button:last-child]:sticky [&>div>button:last-child]:sticky',
  '[&_form>button:last-child]:bottom-[max(1rem,env(safe-area-inset-bottom))] [&>div>button:last-child]:bottom-[max(1rem,env(safe-area-inset-bottom))]',
  '[&_form>button:last-child]:z-10 [&>div>button:last-child]:z-10',
  '[&_form>button:last-child]:shadow-[0_0_0_12px_var(--background),0_-16px_24px_12px_var(--background)] [&>div>button:last-child]:shadow-[0_0_0_12px_var(--background),0_-16px_24px_12px_var(--background)]',
].join(' ')

export default function OnboardingPage() {
  return (
    <section className={STICKY_CONTINUE}>
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
          step={1}
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
      <StepHeader
        step={2}
        title={dict.onboarding.photosTitle}
        subtitle={dict.onboarding.photosSubtitle}
      />
      <PhotoUploader userId={viewer.id} photos={photos} nextHref="/selfie-verification" />
    </>
  )
}
