import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { PageSpinner } from '@/components/ui/spinner'
import { getViewer } from '@/features/auth/session'
import { getOwnProfile, getTags } from '@/features/profile/queries'
import { getRandomSession, loadRandomMessages } from '@/features/randomizer/actions'
import { RandomChat } from '@/features/randomizer/components/random-chat'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).random.title }
}

export default async function RandomizerPage() {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader title={dict.random.title} />
      <section className="flex flex-1 flex-col px-4">
        <Suspense fallback={<PageSpinner />}>
          <Randomizer />
        </Suspense>
      </section>
    </>
  )
}

// Resumes an active session after a reload; otherwise starts at the filters.
async function Randomizer() {
  const viewer = await getViewer()
  if (!viewer) return null
  const [profile, tags, session] = await Promise.all([
    getOwnProfile(viewer.id),
    getTags(),
    getRandomSession(),
  ])
  const messages = session ? await loadRandomMessages(session.id) : []
  return (
    <RandomChat
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
