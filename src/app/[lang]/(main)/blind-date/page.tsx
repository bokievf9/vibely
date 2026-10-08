import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { PageSpinner } from '@/components/ui/spinner'
import { getViewer } from '@/features/auth/session'
import { getOwnProfile, getTags } from '@/features/profile/queries'
import { getBlindSession, loadBlindMessages } from '@/features/blind-date/actions'
import { BlindDate } from '@/features/blind-date/components/blind-date'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).blindDate.title }
}

// The header lives in <BlindDate/>: during a date it shows the partner's alias and the menu.
export default async function BlindDatePage() {
  const dict = await getDictionary()
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title={dict.blindDate.title} />
          <PageSpinner />
        </>
      }
    >
      <BlindDateScreen />
    </Suspense>
  )
}

// Resumes an active date after a reload; otherwise starts at the intro and preferences.
async function BlindDateScreen() {
  const viewer = await getViewer()
  if (!viewer) return null
  const [profile, tags, session] = await Promise.all([
    getOwnProfile(viewer.id),
    getTags(),
    getBlindSession(),
  ])
  const messages = session ? await loadBlindMessages(session.id) : []
  return (
    <BlindDate
      userId={viewer.id}
      tags={tags}
      defaults={{
        genders: profile?.interestedIn ?? ['female', 'male'],
        minAge: 18,
        maxAge: 45,
        tagIds: [],
      }}
      initialSession={session}
      initialMessages={messages}
    />
  )
}
