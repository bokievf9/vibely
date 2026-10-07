import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
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
      <Suspense fallback={<PageSpinner />}>
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
