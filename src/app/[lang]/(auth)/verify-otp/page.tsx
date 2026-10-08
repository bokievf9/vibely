import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Skeleton } from '@/components/ui/skeleton'
import { OtpForm } from '@/features/auth/components/otp-form'
import { localeRedirect } from '@/features/auth/redirect'
import { getPendingPhone } from '@/features/auth/session'
import { getDictionary } from '@/i18n/server'
import { StepHeader } from '../step-header'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.otpTitle }
}

export default async function VerifyOtpPage() {
  const dict = await getDictionary()
  return (
    <section>
      <StepHeader title={dict.auth.otpTitle} subtitle={dict.auth.otpSubtitle} />
      <Suspense
        fallback={
          <div className="flex flex-col gap-5" aria-hidden>
            <Skeleton className="h-11 w-2/3 rounded-full" />
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
            <Skeleton className="h-12" />
          </div>
        }
      >
        <PendingPhoneForm />
      </Suspense>
    </section>
  )
}

async function PendingPhoneForm() {
  const phone = await getPendingPhone()
  if (!phone) return localeRedirect('/login')
  return <OtpForm phone={phone} />
}
