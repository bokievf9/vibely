import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { VerifiedBadge } from '@/components/ui/verified-badge'
import { getViewer } from '@/features/auth/session'
import { ChatCallButton } from '@/features/calls/components/chat-call-button'
import { getCallHistory, getCallSettings } from '@/features/calls/queries'
import { callsEnabled } from '@/features/calls/server/env'
import { unmatch } from '@/features/chat/actions'
import { CHAT_BAR_MATERIAL_CLASS, CHAT_HEADER_CLASS } from '@/features/chat/components/chat-layout'
import { ChatRoom } from '@/features/chat/components/chat-room'
import { ChatShell } from '@/features/chat/components/chat-shell'
import { ChatRoomSkeleton } from '@/features/chat/components/chat-skeletons'
import { getChatRoom } from '@/features/chat/queries'
import { PartnerStatus } from '@/features/presence/components/partner-status'
import { SafetyMenu } from '@/features/safety/components/safety-menu'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).chats.title }
}

export default function ChatPage({ params }: PageProps<'/[lang]/chats/[matchId]'>) {
  return (
    <Suspense fallback={<ChatRoomSkeleton />}>
      <Room params={params} />
    </Suspense>
  )
}

async function Room({ params }: Pick<PageProps<'/[lang]/chats/[matchId]'>, 'params'>) {
  const [{ matchId }, viewer, locale, dict] = await Promise.all([
    params,
    getViewer(),
    getLocale(),
    getDictionary(),
  ])
  const room =
    viewer && /^[0-9a-f-]{36}$/.test(matchId) ? await getChatRoom(matchId, viewer.id) : null
  if (!viewer || !room) notFound()
  const { partner } = room
  const [callSettings, calls] = callsEnabled()
    ? await Promise.all([getCallSettings(matchId), getCallHistory(matchId, viewer.id)])
    : [null, []]

  return (
    <ChatShell>
      {/* Translucent bar over the scroller: messages scroll under it. Fixed 56px row plus the
          notch inset, so the sticky day pills can sit right under it. */}
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
          <Link
            href={localePath(locale, `/profile/${partner.id}`)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl py-1 pr-1 transition-opacity duration-150 active:opacity-70"
            aria-label={dict.chats.viewProfile}
          >
            <Avatar
              photo={partner.photo}
              alt={partner.name}
              size={38}
              className="ring-1 ring-white/10"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-1">
                <h1 className="text-headline truncate leading-tight">{partner.name}</h1>
                <VerifiedBadge size={16} />
              </span>
              <PartnerStatus matchId={matchId} fallback={`@${partner.username}`} />
            </span>
          </Link>
          <div className="flex shrink-0 items-center">
            {callSettings && (
              <ChatCallButton matchId={matchId} partnerName={partner.name} initial={callSettings} />
            )}
            <SafetyMenu
              userId={partner.id}
              name={partner.name}
              onUnmatch={unmatch.bind(null, matchId)}
              calls={callSettings ? calls : undefined}
            />
          </div>
        </div>
      </header>
      <ChatRoom
        key={matchId}
        matchId={matchId}
        viewerId={viewer.id}
        partnerName={partner.name}
        initialMessages={room.messages}
        initialReactions={room.reactions}
        initialHasMore={room.hasMore}
        initialCalls={calls}
      />
    </ChatShell>
  )
}
