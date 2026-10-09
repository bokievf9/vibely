'use client'

import { MessageSquareLock } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { formatChatTime } from '@/i18n/format'
import { pseudonymColor, pseudonymEmoji, pseudonymName } from '@/features/feed/pseudonym'
import type { ConversationPreview } from '../types'
import { AliasAvatar } from './alias-avatar'

// "Private replies" at the top of Chats: open post / prompt / status conversations. Each row shows
// the other person exactly as the conversation page does (alias, post pseudonym, or the real
// person for prompt and status conversations) and what the conversation is about; nothing more.
export function ConversationList({ conversations }: { conversations: ConversationPreview[] }) {
  const { dict } = useI18n()
  const c = dict.conversations
  if (!conversations.length) return null
  return (
    <section aria-labelledby="private-replies" className="flex flex-col">
      <div className="flex flex-col gap-0.5 px-4 pb-1">
        <h2 id="private-replies" className="text-headline flex items-center gap-2">
          <MessageSquareLock className="text-accent size-5" aria-hidden />
          {c.privateReplies}
          <span className="bg-accent/15 text-accent rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">
            {conversations.length}
          </span>
        </h2>
        <p className="text-muted text-footnote">{c.privateRepliesHint}</p>
      </div>
      <ul className="flex flex-col">
        {conversations.map((conv) => (
          <li key={conv.id}>
            <ConversationRow conv={conv} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ConversationRow({ conv }: { conv: ConversationPreview }) {
  const { dict, locale } = useI18n()
  const c = dict.conversations
  const t = dict.blindDate
  const ctx = conv.context
  const who = identity()
  const about =
    ctx?.kind === 'prompt'
      ? ctx.question[locale]
      : ctx?.kind === 'post'
        ? (ctx.body ?? c.postUnavailable)
        : ctx?.kind === 'status'
          ? `${ctx.emoji} ${ctx.text ?? dict.statuses.statusRemoved}`
          : ''
  const aboutLabel =
    ctx?.kind === 'prompt'
      ? c.pinnedPrompt
      : ctx?.kind === 'status'
        ? ctx.iAmAuthor
          ? dict.statuses.yourStatusPinned
          : dict.statuses.theirStatus
        : c.pinnedPost
  const last = conv.lastBody
    ? `${conv.lastMine ? dict.chats.you : ''}${conv.lastBody}`
    : c.noMessagesYet

  function identity() {
    if (ctx?.kind === 'post' && !ctx.iAmAuthor) {
      if (ctx.author) {
        const a = ctx.author
        return {
          avatar: (
            <Avatar
              photo={a.photoUrl ? { url: a.photoUrl, width: 56, height: 56 } : null}
              alt=""
              size={56}
            />
          ),
          title: a.age !== null ? `${a.name}, ${a.age}` : a.name,
        }
      }
      const p = ctx.authorPseudonym
      return {
        avatar: (
          <span
            aria-hidden
            className={`inline-flex size-14 shrink-0 items-center justify-center rounded-full text-2xl ${p ? pseudonymColor(p) : 'bg-surface-raised'}`}
          >
            {p ? pseudonymEmoji(p) : '🙂'}
          </span>
        ),
        title: p ? pseudonymName(dict.feed.pseudonym, p) : c.postAuthor,
      }
    }
    if (conv.partner) {
      return {
        avatar: <Avatar photo={conv.partner.photo} alt="" size={56} />,
        title: `${conv.partner.name}, ${conv.partner.age}`,
      }
    }
    return {
      avatar: <AliasAvatar alias={conv.partnerAlias} size={56} />,
      title: fmt(t.partner, { n: conv.partnerAlias }),
    }
  }

  const at = conv.lastAt ?? conv.startedAt
  return (
    <LocaleLink
      href={`/blind-date/${conv.id}`}
      className="group active:bg-fill flex items-center gap-3.5 pl-4 transition-colors duration-150"
    >
      <span className="shrink-0 py-2.5">{who.avatar}</span>
      <div className="flex min-h-[4.75rem] min-w-0 flex-1 flex-col justify-center gap-0.5 pr-4 shadow-[inset_0_-1px_0_var(--border)] group-last:shadow-none">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-headline min-w-0 truncate">{who.title}</span>
          <time className="text-footnote text-muted shrink-0 tabular-nums" dateTime={at}>
            {formatChatTime(at, locale)}
          </time>
        </div>
        <span className="text-muted text-caption min-w-0 truncate">
          {aboutLabel}: {about}
        </span>
        <span className="text-callout text-muted min-w-0 truncate">{last}</span>
      </div>
    </LocaleLink>
  )
}
