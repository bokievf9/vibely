'use client'

import { MessagesSquare } from 'lucide-react'
import { EmptyState } from '@/components/layout/empty-state'
import { Avatar } from '@/components/ui/avatar'
import { LocaleLink, useI18n } from '@/i18n/client'
import { formatChatTime } from '@/i18n/format'
import type { ChatPreview } from '../types'

export function ChatList({ chats }: { chats: ChatPreview[] }) {
  const { dict, locale } = useI18n()
  const previewText = (m: NonNullable<ChatPreview['lastMessage']>) =>
    m.kind === 'deleted'
      ? dict.chats.deleted
      : m.kind === 'photo'
        ? `📷 ${m.body ?? dict.chats.photo}`
        : (m.body ?? '')
  if (!chats.length) {
    return <EmptyState icon={MessagesSquare} title={dict.chats.empty} text={dict.chats.emptyHint} />
  }

  return (
    <ul className="flex flex-col">
      {chats.map((c) => (
        <li key={c.matchId}>
          <LocaleLink
            href={`/chats/${c.matchId}`}
            className="active:bg-surface flex items-center gap-3 px-4 py-3"
          >
            <Avatar photo={c.partner.photo} alt={c.partner.name} size={56} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold">{c.partner.name}</span>
                <time
                  className="text-muted shrink-0 text-xs"
                  dateTime={c.lastMessage?.at ?? c.createdAt}
                >
                  {formatChatTime(c.lastMessage?.at ?? c.createdAt, locale)}
                </time>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={
                    c.unread ? 'truncate text-sm font-medium' : 'text-muted truncate text-sm'
                  }
                >
                  {c.lastMessage
                    ? `${c.lastMessage.mine ? dict.chats.you : ''}${previewText(c.lastMessage)}`
                    : dict.chats.newMatch}
                </span>
                {c.unread > 0 && (
                  <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-bold">
                    {c.unread}
                  </span>
                )}
              </div>
            </div>
          </LocaleLink>
        </li>
      ))}
    </ul>
  )
}
