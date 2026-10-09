import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { getViewer } from '@/features/auth/session'
import { listMyConversations } from '@/features/blind-date/actions'
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
  if (!viewer) return <ChatList chats={[]} conversations={[]} />
  // Private replies (feed + question of the day) sit above the match chats; empty until the
  // 20261009000220 migration is live. Duo chats (20261009000261) come first.
  const [chats, conversations, groups] = await Promise.all([
    getChatList(viewer.id),
    listMyConversations(),
    getGroupChats(),
  ])
  return (
    <>
      <GroupChatList groups={groups} viewerId={viewer.id} />
      {/* With only duo chats, no "no chats yet" screen under them. */}
      {(chats.length > 0 || conversations.length > 0 || groups.length === 0) && (
        <ChatList chats={chats} conversations={conversations} />
      )}
    </>
  )
}
