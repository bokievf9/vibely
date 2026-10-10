import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Clock } from 'lucide-react'
import { FormError } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { localeRedirect } from '@/features/auth/redirect'
import { getViewer, nextStepFor } from '@/features/auth/session'
import { SelfieCapture } from '@/features/verification/components/selfie-capture'
import { getLatestRejection } from '@/features/verification/queries'
import { SHOWN_REJECTION_CODES, localizeReason } from '@/features/safety/reason-codes'
import { fmt } from '@/i18n/config'
import { getDictionary } from '@/i18n/server'
import { StepHeader } from '../step-header'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).verification.title }
}

export default function SelfieVerificationPage() {
  return (
    <section>
      <Suspense
        fallback={
          <div className="flex flex-col gap-5" aria-hidden>
            <Skeleton className="h-24" />
            <Skeleton className="aspect-[3/4] rounded-3xl" />
          </div>
        }
      >
        <VerificationStep />
      </Suspense>
    </section>
  )
}

async function VerificationStep() {
  const [viewer, dict] = await Promise.all([getViewer(), getDictionary()])
  const next = nextStepFor(viewer)
  if (!viewer?.profile || next !== '/selfie-verification') return localeRedirect(next)

  if (viewer.profile.verificationStatus === 'pending') {
    return (
      <div className="flex flex-col items-center gap-4 pt-10 text-center">
        <Clock className="text-accent size-16" aria-hidden />
        <StepHeader
          title={dict.verification.pendingTitle}
          subtitle={dict.verification.pendingSubtitle}
        />
        <SignOutButton />
      </div>
    )
  }

  const rejection = await getLatestRejection(viewer.id)
  return (
    <>
      <StepHeader step={3} title={dict.verification.title} subtitle={dict.verification.subtitle} />
      {rejection && (
        <div className="mb-5">
          <FormError
            message={fmt(dict.verification.rejected, {
              reason: localizeReason(rejection, SHOWN_REJECTION_CODES, dict.moderation.rejection),
            })}
          />
        </div>
      )}
      <SelfieCapture userId={viewer.id} />
    </>
  )
}
