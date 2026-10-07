import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { PageSpinner } from '@/components/ui/spinner'
import { getViewer } from '@/features/auth/session'
import { ChatList } from '@/features/chat/components/chat-list'
import { getChatList } from '@/features/chat/queries'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).chats.title }
}

export default async function ChatsPage() {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader title={dict.chats.title} />
      <Suspense fallback={<PageSpinner />}>
        <Chats />
      </Suspense>
    </>
  )
}

async function Chats() {
  const viewer = await getViewer()
  return <ChatList chats={viewer ? await getChatList(viewer.id) : []} />
}
