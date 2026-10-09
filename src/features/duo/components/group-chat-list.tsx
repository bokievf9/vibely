'use client'

import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { formatChatTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import type { GroupPreview } from '../types'
import { DuoAvatars } from './duo-photos'

// "Duo chats" section at the top of Chats: one row per 4-person group.
export function GroupChatList({ groups, viewerId }: { groups: GroupPreview[]; viewerId: string }) {
  const { dict, locale } = useI18n()
  const t = dict.duo
  if (!groups.length) return null
  return (
    <section aria-labelledby="duo-chats" className="pt-2">
      <h2 id="duo-chats" className="text-headline px-4 pt-1 pb-1">
        {t.groupChats}
      </h2>
      <ul className="flex flex-col">
        {groups.map((g) => {
          const others = g.members.filter((m) => m.id !== viewerId && !m.left)
          const nameOf = (id: string | null) => g.members.find((m) => m.id === id)?.name ?? ''
          const m = g.last
          const preview = !m
            ? t.systemMatched
            : m.kind === 'system'
              ? m.systemEvent === 'matched'
                ? t.systemMatched
                : fmt(m.systemEvent === 'removed' ? t.systemRemoved : t.systemLeft, {
                    name: nameOf(m.aboutUser),
                  })
              : `${m.senderId === viewerId ? dict.chats.you : `${nameOf(m.senderId)}: `}${
                  m.kind === 'image' ? t.photoPreview : (m.body ?? '')
                }`
          const at = m?.at ?? g.createdAt
          return (
            <li key={g.groupId}>
              <LocaleLink
                href={`/chats/group/${g.groupId}`}
                className="group active:bg-fill flex items-center gap-3.5 pl-4 transition-colors duration-150"
              >
                <span className="shrink-0 py-2.5">
                  <DuoAvatars members={others.slice(0, 2)} size={44} />
                </span>
                <div className="flex min-h-[5rem] min-w-0 flex-1 flex-col justify-center gap-1 pr-4 shadow-[inset_0_-1px_0_var(--border)] group-last:shadow-none">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn('text-headline min-w-0 truncate', g.unread > 0 && 'font-bold')}
                    >
                      {others.map((o) => o.name).join(', ') || t.groupTitle}
                    </span>
                    <time
                      className={cn(
                        'text-footnote shrink-0 tabular-nums',
                        g.unread ? 'text-accent font-semibold' : 'text-muted',
                      )}
                      dateTime={at}
                    >
                      {formatChatTime(at, locale)}
                    </time>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-callout min-w-0 truncate',
                        g.unread ? 'text-foreground font-medium' : 'text-muted',
                      )}
                    >
                      {preview}
                    </span>
                    {g.unread > 0 && (
                      <span
                        aria-label={fmt(dict.nav.unread, { count: g.unread })}
                        className="bg-accent-gradient text-accent-foreground flex h-[1.375rem] min-w-[1.375rem] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums"
                      >
                        {g.unread > 99 ? '99+' : g.unread}
                      </span>
                    )}
                  </div>
                </div>
              </LocaleLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
