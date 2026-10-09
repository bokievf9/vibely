import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { getViewer } from '@/features/auth/session'
import { ChatList } from '@/features/chat/components/chat-list'
import { ChatListSkeleton } from '@/features/chat/components/chat-skeletons'
import { getChatList } from '@/features/chat/queries'
import { getDictionary } from '@/i18n/server'
import { GroupChatList } from '@/features/duo/components/group-chat-list'
import { getGroupChats } from '@/features/duo/queries'

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
  const [chats, groups] = viewer
    ? await Promise.all([getChatList(viewer.id), getGroupChats()])
    : [[], []]
  return (
    <>
      {viewer && <GroupChatList groups={groups} viewerId={viewer.id} />}
      {/* With only duo chats, no "no chats yet" screen under them. */}
      {(chats.length > 0 || groups.length === 0) && <ChatList chats={chats} />}
    </>
  )
}
