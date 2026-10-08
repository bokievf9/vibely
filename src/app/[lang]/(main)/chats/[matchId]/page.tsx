import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { PageSpinner } from '@/components/ui/spinner'
import { VerifiedBadge } from '@/components/ui/verified-badge'
import { getViewer } from '@/features/auth/session'
import { ChatCallButton } from '@/features/calls/components/chat-call-button'
import { getCallHistory, getCallSettings } from '@/features/calls/queries'
import { callsEnabled } from '@/features/calls/server/env'
import { unmatch } from '@/features/chat/actions'
import { ChatRoom } from '@/features/chat/components/chat-room'
import { getChatRoom } from '@/features/chat/queries'
import { PartnerStatus } from '@/features/presence/components/partner-status'
import { SafetyMenu } from '@/features/safety/components/safety-menu'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).chats.title }
}

export default function ChatPage({ params }: PageProps<'/[lang]/chats/[matchId]'>) {
  return (
    <Suspense fallback={<PageSpinner />}>
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
    <>
      <header className="bg-background/90 border-border sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
        <Link href={localePath(locale, '/chats')} aria-label={dict.common.back} className="p-2">
          <ChevronLeft className="size-6" />
        </Link>
        <Link
          href={localePath(locale, `/profile/${partner.id}`)}
          className="flex min-w-0 flex-1 items-center gap-2"
          aria-label={dict.chats.viewProfile}
        >
          <Avatar photo={partner.photo} alt={partner.name} size={36} />
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-1">
              <h1 className="truncate leading-tight font-semibold">{partner.name}</h1>
              <VerifiedBadge size={16} />
              <span className="text-muted min-w-0 truncate text-xs">@{partner.username}</span>
            </span>
            <PartnerStatus matchId={matchId} />
          </span>
        </Link>
        {callSettings && (
          <ChatCallButton matchId={matchId} partnerName={partner.name} initial={callSettings} />
        )}
        <SafetyMenu
          userId={partner.id}
          name={partner.name}
          onUnmatch={unmatch.bind(null, matchId)}
        />
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
    </>
  )
}
