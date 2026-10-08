import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Ban } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { localeRedirect } from '@/features/auth/redirect'
import { getViewer } from '@/features/auth/session'
import { BAN_CODES, localizeReason } from '@/features/safety/reason-codes'
import { fmt } from '@/i18n/config'
import { getDictionary } from '@/i18n/server'
import { StepHeader } from '../step-header'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).banned.title }
}

export default function BannedPage() {
  return (
    <section className="flex flex-col items-center gap-4 pt-10 text-center">
      <Ban className="size-16 text-red-500" aria-hidden />
      <Suspense fallback={<PageSpinner />}>
        <BanDetails />
      </Suspense>
    </section>
  )
}

async function BanDetails() {
  const [viewer, dict] = await Promise.all([getViewer(), getDictionary()])
  const reason = viewer?.profile?.banReason
  if (!reason) return localeRedirect('/')
  return (
    <>
      <StepHeader
        title={dict.banned.title}
        subtitle={fmt(dict.banned.reason, {
          reason: localizeReason(reason, BAN_CODES, dict.moderation.ban),
        })}
      />
      <SignOutButton />
    </>
  )
}
