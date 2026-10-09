import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { getViewer } from '@/features/auth/session'
import { listMyConversations } from '@/features/blind-date/actions'
import { ChatList } from '@/features/chat/components/chat-list'
import { ChatListSkeleton } from '@/features/chat/components/chat-skeletons'
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
      <Suspense fallback={<ChatListSkeleton label={dict.chatui.loadingChats} />}>
        <Chats />
      </Suspense>
    </>
  )
}

async function Chats() {
  const viewer = await getViewer()
  if (!viewer) return <ChatList chats={[]} conversations={[]} />
  // Private replies (feed + question of the day) sit above the match chats; empty until the
  // 20261009000220 migration is live.
  const [chats, conversations] = await Promise.all([getChatList(viewer.id), listMyConversations()])
  return <ChatList chats={chats} conversations={conversations} />
}
