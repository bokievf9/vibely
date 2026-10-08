'use client'

import { Pencil, Reply, X } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import type { ChatMessage } from '../types'
import { MessageQuote } from './message-quote'

export type ComposerMode = { kind: 'reply' | 'edit'; message: ChatMessage }

type Props = { mode: ComposerMode; author: string; onCancel: () => void }

// "Reply to …" / "Edit message" strip above the input, with the quoted text and a cancel ×.
export function ComposerBanner({ mode, author, onCancel }: Props) {
  const { dict } = useI18n()
  const { message } = mode
  const Icon = mode.kind === 'reply' ? Reply : Pencil
  return (
    <div className="flex items-center gap-2">
      <Icon className="text-accent size-5 shrink-0" aria-hidden />
      <MessageQuote
        className="flex-1"
        mine={false}
        author={
          mode.kind === 'reply' ? fmt(dict.chats.replyTo, { name: author }) : dict.chats.editing
        }
        quote={{
          id: message.id,
          senderId: message.senderId,
          body: message.body,
          mediaKind: message.media?.kind ?? message.expiredMedia,
          deleted: !!message.deletedAt,
        }}
      />
      <button type="button" onClick={onCancel} aria-label={dict.common.cancel} className="p-1">
        <X className="text-muted size-5" />
      </button>
    </div>
  )
}
