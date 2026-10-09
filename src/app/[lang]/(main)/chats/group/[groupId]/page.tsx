import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getViewer } from '@/features/auth/session'
import { CHAT_BAR_MATERIAL_CLASS, CHAT_HEADER_CLASS } from '@/features/chat/components/chat-layout'
import { ChatShell } from '@/features/chat/components/chat-shell'
import { ChatRoomSkeleton } from '@/features/chat/components/chat-skeletons'
import { DuoAvatars } from '@/features/duo/components/duo-photos'
import { GroupMenu } from '@/features/duo/components/group-menu'
import { GroupRoom } from '@/features/duo/components/group-room'
import { getGroupRoom } from '@/features/duo/queries'
import { fmt, localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).duo.groupTitle }
}

export default function GroupChatPage({ params }: PageProps<'/[lang]/chats/group/[groupId]'>) {
  return (
    <Suspense fallback={<ChatRoomSkeleton />}>
      <Room params={params} />
    </Suspense>
  )
}

async function Room({ params }: Pick<PageProps<'/[lang]/chats/group/[groupId]'>, 'params'>) {
  const [{ groupId }, viewer, locale, dict] = await Promise.all([
    params,
    getViewer(),
    getLocale(),
    getDictionary(),
  ])
  const room = viewer && /^[0-9a-f-]{36}$/.test(groupId) ? await getGroupRoom(groupId) : null
  if (!viewer || !room) notFound()
  const others = room.members.filter((m) => m.id !== viewer.id)
  const present = others.filter((m) => !m.left)

  return (
    <ChatShell>
      <header className={CHAT_HEADER_CLASS}>
        <div aria-hidden className={`${CHAT_BAR_MATERIAL_CLASS} border-b`} />
        <div className="relative flex h-[3.25rem] w-full min-w-0 items-center gap-1 px-1">
          <Link
            href={localePath(locale, '/chats')}
            aria-label={dict.common.back}
            className="flex size-11 shrink-0 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-90"
          >
            <ChevronLeft className="size-6" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2.5 py-1 pr-1">
            <DuoAvatars members={present.slice(0, 2)} size={34} />
            <span className="flex min-w-0 flex-1 flex-col">
              <h1 className="text-headline truncate leading-tight">
                {present.map((m) => m.name).join(', ') || dict.duo.groupTitle}
              </h1>
              <span className="text-muted truncate text-xs">
                {fmt(dict.duo.groupMembers, { count: present.length + 1 })}
              </span>
            </span>
          </div>
          <GroupMenu groupId={groupId} viewerId={viewer.id} members={room.members} />
        </div>
      </header>
      <GroupRoom
        key={groupId}
        groupId={groupId}
        viewerId={viewer.id}
        members={room.members}
        initialMessages={room.messages}
        initialHasMore={room.hasMore}
      />
    </ChatShell>
  )
}
