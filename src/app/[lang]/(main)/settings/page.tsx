import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PageSpinner } from '@/components/ui/spinner'
import { DeleteAccount } from '@/features/account/components/delete-account'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { getViewer } from '@/features/auth/session'
import { LanguageSwitcher } from '@/features/profile/components/language-switcher'
import { LastSeenToggle } from '@/features/presence/components/last-seen-toggle'
import { PushToggle } from '@/features/push/components/push-toggle'
import { BlockedUsers } from '@/features/settings/components/blocked-users'
import { NotificationPrefsRows } from '@/features/settings/components/notification-prefs'
import { PauseToggle } from '@/features/settings/components/pause-toggle'
import { SettingsSection } from '@/features/settings/components/settings-section'
import {
  getBlockedUsers,
  getNotificationPrefs,
  getPrivacySettings,
} from '@/features/settings/queries'
import { UsernameSettingsRows } from '@/features/username/components/username-settings'
import { getUsernameSettings } from '@/features/username/queries'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settings.title, robots: { index: false } }
}

export default async function SettingsPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()])
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-1">
            <Link
              href={localePath(locale, '/profile')}
              aria-label={dict.common.back}
              className="-ml-2 p-1"
            >
              <ChevronLeft className="size-6" />
            </Link>
            {dict.settings.title}
          </span>
        }
      />
      <Suspense fallback={<PageSpinner />}>
        <Settings />
      </Suspense>
    </>
  )
}

async function Settings() {
  const [viewer, locale, dict] = await Promise.all([getViewer(), getLocale(), getDictionary()])
  if (!viewer?.profile) return null
  const [privacy, prefs, blocked, username] = await Promise.all([
    getPrivacySettings(viewer.id),
    getNotificationPrefs(viewer.id),
    getBlockedUsers(),
    getUsernameSettings(),
  ])

  return (
    <div className="flex flex-col gap-8 px-4 pb-6">
      {username && (
        <SettingsSection title={dict.username.section}>
          <UsernameSettingsRows initial={username} />
        </SettingsSection>
      )}
      <SettingsSection title={dict.settings.notifications}>
        <PushToggle />
        <NotificationPrefsRows initial={prefs} />
      </SettingsSection>
      <SettingsSection title={dict.settings.privacy}>
        <LastSeenToggle initial={privacy.showLastSeen} />
        <PauseToggle discoverable={privacy.discoverable} />
      </SettingsSection>
      <SettingsSection title={dict.settings.blocked}>
        <BlockedUsers initial={blocked} />
      </SettingsSection>
      <SettingsSection title={dict.profile.language} card={false}>
        <LanguageSwitcher />
      </SettingsSection>
      <SettingsSection title={dict.legal.section}>
        {(['terms', 'privacy'] as const).map((doc) => (
          <Link
            key={doc}
            href={localePath(locale, `/${doc}`)}
            className="flex h-12 items-center justify-between px-4"
          >
            {dict.legal[doc]} <ChevronRight className="text-muted size-5" aria-hidden />
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
