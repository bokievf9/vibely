import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageSpinner } from '@/components/ui/spinner'
import { getViewer } from '@/features/auth/session'
import { localeRedirect } from '@/features/auth/redirect'
import { getBlindSession, loadBlindMessages } from '@/features/blind-date/actions'
import { Conversation } from '@/features/blind-date/components/conversation'
import { getDictionary } from '@/i18n/server'

const isUuid = (id: string) => /^[0-9a-f-]{36}$/.test(id)

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).conversations.privateReplies, robots: { index: false } }
}

// A private reply (feed post) or "Say hi" (question of the day) conversation, opened from Chats
// or a push. Blind dates have their own screen at /blind-date.
export default function ConversationPage({ params }: PageProps<'/[lang]/blind-date/[sessionId]'>) {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Screen params={params} />
    </Suspense>
  )
}

async function Screen({ params }: Pick<PageProps<'/[lang]/blind-date/[sessionId]'>, 'params'>) {
  const [{ sessionId }, viewer] = await Promise.all([params, getViewer()])
  if (!viewer || !isUuid(sessionId)) notFound()
  const session = await getBlindSession(sessionId)
  if (!session) notFound()
  if (session.kind === 'blind') return localeRedirect('/blind-date')
  const messages = await loadBlindMessages(session.id)
  return <Conversation userId={viewer.id} initialSession={session} initialMessages={messages} />
}
