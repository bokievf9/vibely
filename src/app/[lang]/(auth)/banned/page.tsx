import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Ban } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { localeRedirect } from '@/features/auth/redirect'
import { getViewer } from '@/features/auth/session'
import { BAN_CODES, localizeReason } from '@/features/safety/reason-codes'
import { AppealForm } from '@/features/sanctions/components/appeal-form'
import { getMyAppeal } from '@/features/sanctions/queries'
import { fmt } from '@/i18n/config'
import { formatDay, formatTime } from '@/i18n/format'
import { getDictionary, getLocale } from '@/i18n/server'
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
  const [viewer, dict, locale] = await Promise.all([getViewer(), getDictionary(), getLocale()])
  const reason = viewer?.profile?.banReason
  // Not banned (any more: an expired temporary ban is lifted by getViewer).
  if (!reason) return localeRedirect('/')
  const until = viewer.profile?.bannedUntil
  const appeal = await getMyAppeal()
  const t = dict.sanctions
  return (
    <>
      <StepHeader
        title={dict.banned.title}
        subtitle={fmt(dict.banned.reason, {
          reason: localizeReason(reason, BAN_CODES, dict.moderation.ban),
        })}
      />
      <p className="text-muted -mt-4 text-sm">
        {until
          ? fmt(t.bannedUntil, { date: `${formatDay(until, locale)} ${formatTime(until, locale)}` })
          : t.bannedForever}
      </p>
      {appeal?.status === 'open' ? (
        <p className="text-muted text-sm">
          {fmt(t.appealOpen, { date: formatDay(appeal.createdAt, locale) })}
        </p>
      ) : (
        <>
          {appeal?.status === 'rejected' && (
            <p className="text-muted text-sm">{t.appealRejected}</p>
          )}
          <AppealForm />
        </>
      )}
      <SignOutButton />
    </>
  )
}
