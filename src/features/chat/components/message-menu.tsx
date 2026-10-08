'use client'

import { Copy, Pencil, Reply, Trash2, type LucideIcon } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { REACTIONS, type ChatMessage, type ReactionEmoji } from '../types'

export type MenuAction = 'reply' | 'copy' | 'edit' | 'delete'

type Props = {
  message: ChatMessage | null
  mine: boolean
  // Still inside the edit window when the menu was opened.
  editable: boolean
  myReaction: ReactionEmoji | null
  onClose: () => void
  onReact: (emoji: ReactionEmoji) => void
  onAction: (action: MenuAction) => void
}

// Long press / right click on a bubble: quick reactions plus Reply, Copy, Edit, Delete.
export function MessageMenu(props: Props) {
  const { message, mine, myReaction, onClose, onReact, onAction } = props
  const { dict } = useI18n()
  const editable = props.editable && mine && !!message?.body
  const items: { action: MenuAction; icon: LucideIcon; label: string; show: boolean }[] = [
    { action: 'reply', icon: Reply, label: dict.chats.reply, show: true },
    { action: 'copy', icon: Copy, label: dict.chats.copy, show: !!message?.body },
    { action: 'edit', icon: Pencil, label: dict.chats.edit, show: editable },
    { action: 'delete', icon: Trash2, label: dict.chats.delete, show: mine },
  ]

  return (
    <Modal open={!!message} onClose={onClose} title={dict.chats.messageActions}>
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-1" role="group" aria-label={dict.chats.reactions}>
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-pressed={myReaction === emoji}
              onClick={() => onReact(emoji)}
              className={cn(
                'flex size-12 items-center justify-center rounded-full text-2xl transition active:scale-90',
                myReaction === emoji ? 'bg-accent/30' : 'bg-background',
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
        <ul className="bg-background divide-border flex flex-col divide-y rounded-2xl">
          {items
            .filter((i) => i.show)
            .map(({ action, icon: Icon, label }) => (
              <li key={action}>
                <button
                  type="button"
                  onClick={() => onAction(action)}
                  className={cn(
                    'flex h-12 w-full items-center gap-3 px-4 text-left',
                    action === 'delete' && 'text-red-400',
                  )}
                >
                  <Icon className="size-5" aria-hidden /> {label}
                </button>
              </li>
            ))}
        </ul>
      </div>
    </Modal>
  )
}
