import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { DeleteAccount } from '@/features/account/components/delete-account'
import { PasswordSettingsRows } from '@/features/auth/components/password-settings'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { getHasPassword } from '@/features/auth/password-queries'
import { getViewer } from '@/features/auth/session'
import { crossedPathsEnabled } from '@/features/crossed-paths/actions'
import { CrossedPathsToggle } from '@/features/crossed-paths/components/crossed-paths-toggle'
import { LanguageSwitcher } from '@/features/profile/components/language-switcher'
import { LastSeenToggle } from '@/features/presence/components/last-seen-toggle'
import { PushToggle } from '@/features/push/components/push-toggle'
import { BlockedUsers } from '@/features/settings/components/blocked-users'
import { IncognitoToggle } from '@/features/settings/components/incognito-toggle'
import { NotificationPrefsRows } from '@/features/settings/components/notification-prefs'
import { duoAvailable } from '@/features/duo/queries'
import { PauseToggle } from '@/features/settings/components/pause-toggle'
import { PromoSettingsRow } from '@/features/promo/components/promo-settings'
import { getVipStatus } from '@/features/promo/queries'
import { SettingsSection } from '@/features/settings/components/settings-section'
import { SettingsSkeleton } from '@/features/settings/components/settings-skeleton'
import {
  getBlockedUsers,
  getIncognito,
  getNotificationPrefs,
  getPrivacySettings,
} from '@/features/settings/queries'
import { UsernameSettingsRows } from '@/features/username/components/username-settings'
import { getUsernameSettings } from '@/features/username/queries'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'
import { ReadReceiptsToggle } from '@/features/vip-perks/components/read-receipts-toggle'
import { PlansSettingsRow } from '@/features/plans/components/plan-entries'
import { PaymentHistorySettings } from '@/features/payments/components/payment-history'
import { ReplayTourRow } from '@/features/tour/components/replay-tour-row'
import { getReadReceiptsSetting } from '@/features/vip-perks/queries'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settings.title, robots: { index: false } }
}

export default async function SettingsPage() {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader
        title={dict.settings.title}
        back={{ href: '/profile', label: dict.common.back }}
      />
      <Suspense fallback={<SettingsSkeleton label={dict.common.loading} />}>
        <Settings />
      </Suspense>
    </>
  )
}

async function Settings() {
  const [viewer, locale, dict] = await Promise.all([getViewer(), getLocale(), getDictionary()])
  if (!viewer?.profile) return null
  const [privacy, prefs, blocked, username, hasPassword, crossed, vip, incognito, duo, receipts] =
    await Promise.all([
      getPrivacySettings(viewer.id),
      getNotificationPrefs(viewer.id),
      getBlockedUsers(),
      getUsernameSettings(),
      getHasPassword(),
      crossedPathsEnabled(),
      // Null until the promo migration (20261009000230) is applied: the row is hidden then.
      getVipStatus(),
      getIncognito(viewer.id),
      // False until the Duo Dating migration (20261009000261): its switch is hidden then.
      duoAvailable(),
      // Null until 20261009000290: the read receipts switch is hidden then.
      getReadReceiptsSetting(),
    ])

  return (
    <div className="flex flex-col gap-7 px-4 pt-1 pb-8">
      <PlansSettingsRow />
      {username && (
        <SettingsSection title={dict.username.section}>
          <UsernameSettingsRows initial={username} />
        </SettingsSection>
      )}
      <SettingsSection title={dict.password.section}>
        <PasswordSettingsRows
          initial={hasPassword}
          username={username?.username ?? viewer.profile.username}
        />
      </SettingsSection>
      <SettingsSection title={dict.settings.notifications}>
        <PushToggle />
        <NotificationPrefsRows initial={prefs} hidden={duo ? [] : ['duo']} />
      </SettingsSection>
      {/* The guided tour's "Privacy and safety" step lights up this whole group. */}
      <div data-tour="settings-privacy">
        <SettingsSection title={dict.settings.privacy}>
          <LastSeenToggle initial={privacy.showLastSeen} />
          {receipts && (
            <ReadReceiptsToggle initial={receipts.send} available={receipts.available} />
          )}
          <PauseToggle discoverable={privacy.discoverable} />
          {incognito !== null && <IncognitoToggle initial={incognito} />}
          {crossed !== null && <CrossedPathsToggle initial={crossed} />}
        </SettingsSection>
      </div>
      <PaymentHistorySettings />
      {vip && (
        <SettingsSection title={dict.promo.section}>
          <PromoSettingsRow initial={vip} />
        </SettingsSection>
      )}
      <SettingsSection title={dict.settings.blocked}>
        <BlockedUsers initial={blocked} />
      </SettingsSection>
      <SettingsSection title={dict.tour.settings.section}>
        <ReplayTourRow />
      </SettingsSection>
      <SettingsSection title={dict.profile.language} card={false}>
        <LanguageSwitcher />
      </SettingsSection>
      <SettingsSection title={dict.legal.section}>
        {(['terms', 'privacy'] as const).map((doc) => (
          <Link
            key={doc}
            href={localePath(locale, `/${doc}`)}
            className="active:bg-fill flex min-h-[3.25rem] items-center justify-between gap-3 px-4 py-3 text-[16px] font-medium tracking-[-0.01em] transition-colors"
          >
            <span className="min-w-0">{dict.legal[doc]}</span>
            <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
          </Link>
        ))}
      </SettingsSection>
      <SettingsSection title={dict.settings.account} card={false}>
        <SignOutButton />
        <DeleteAccount />
      </SettingsSection>
    </div>
  )
}
