'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, Reply, X } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import type { ChatMessage } from '../types'
import { MessageQuote } from './message-quote'

export type ComposerMode = { kind: 'reply' | 'edit'; message: ChatMessage }

type Props = { mode: ComposerMode | null; author: string; onCancel: () => void }

const EASE_OUT = [0.23, 1, 0.32, 1] as const

// "Reply to …" / "Edit message" strip above the input, with the quoted text and a cancel ×.
// Opens and closes by height (the one place a height animation is worth it: the input moves with
// it instead of jumping); the content fades so it never shows squashed.
export function ComposerBanner({ mode, author, onCancel }: Props) {
  const { dict } = useI18n()
  return (
    <AnimatePresence initial={false}>
      {mode && (
        <motion.div
          key="banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="relative overflow-hidden"
        >
          <BannerContent
            mode={mode}
            author={author}
            onCancel={onCancel}
            cancel={dict.common.cancel}
          >
            {mode.kind === 'reply' ? fmt(dict.chats.replyTo, { name: author }) : dict.chats.editing}
          </BannerContent>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function BannerContent({
  mode,
  cancel,
  onCancel,
  children,
}: Props & { mode: ComposerMode; cancel: string; children: string }) {
  const { message } = mode
  const Icon = mode.kind === 'reply' ? Reply : Pencil
  return (
    <div className="flex items-center gap-2 pb-2">
      <Icon className="text-accent ml-1 size-5 shrink-0" aria-hidden />
      <MessageQuote
        className="min-w-0 flex-1"
        mine={false}
        author={children}
        quote={{
          id: message.id,
          senderId: message.senderId,
          body: message.body,
          mediaKind: message.media?.kind ?? message.expiredMedia,
          deleted: !!message.deletedAt,
        }}
      />
      <button
        type="button"
        // Keep the keyboard up: the input must not lose focus to this button.
        onPointerDown={(e) => e.preventDefault()}
        onClick={onCancel}
        aria-label={cancel}
        className="text-muted active:bg-fill flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,transform,scale] duration-150 ease-out active:scale-90"
      >
        <X className="size-5" />
      </button>
    </div>
  )
}
