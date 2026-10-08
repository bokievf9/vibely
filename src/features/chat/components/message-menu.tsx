'use client'

import { useState } from 'react'
import { Copy, Flag, Pencil, Reply, Trash2, type LucideIcon } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { ReportDialog } from '@/features/safety/components/report-dialog'
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

// Destructive actions are drawn in the danger color.
const DANGER: ReadonlySet<MenuAction> = new Set<MenuAction>(['delete'])

// Long press / right click on a bubble: quick reactions plus Reply, Copy, Edit, Delete.
// The pressed bubble stays lifted behind the sheet (see MessageBubble `lifted`), so the sheet
// reads as coming from it.
export function MessageMenu(props: Props) {
  const { message, mine, myReaction, onClose, onReact, onAction } = props
  const { dict } = useI18n()
  // "Report message" (the partner's messages only) closes the menu and opens the report dialog.
  const [reporting, setReporting] = useState<string | null>(null)
  const reportable = !mine && !!message && !message.deletedAt
  const editable = props.editable && mine && !!message?.body
  const items: { action: MenuAction; icon: LucideIcon; label: string; show: boolean }[] = [
    { action: 'reply', icon: Reply, label: dict.chats.reply, show: true },
    { action: 'copy', icon: Copy, label: dict.chats.copy, show: !!message?.body },
    { action: 'edit', icon: Pencil, label: dict.chats.edit, show: editable },
    { action: 'delete', icon: Trash2, label: dict.chats.delete, show: mine },
  ]

  const menu = (
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
                'flex size-12 items-center justify-center rounded-full text-2xl transition-[transform,scale,background-color] duration-150 ease-out active:scale-90',
                myReaction === emoji ? 'bg-accent/30 ring-accent/60 ring-2' : 'bg-background',
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
        <ul className="bg-background divide-border flex flex-col divide-y overflow-hidden rounded-2xl">
          {items
            .filter((i) => i.show)
            .map(({ action, icon: Icon, label }) => (
              <li key={action}>
                <button
                  type="button"
                  onClick={() => onAction(action)}
                  className={cn(
                    'active:bg-surface flex h-13 w-full items-center gap-3 px-4 text-left transition-colors duration-150',
                    // TODO(integration): text-danger once the shell tokens land.
                    DANGER.has(action) && 'text-danger',
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">{label}</span>
                </button>
              </li>
            ))}
          {reportable && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setReporting(message.id)
                  onClose()
                }}
                className="active:bg-surface text-danger flex h-13 w-full items-center gap-3 px-4 text-left transition-colors duration-150"
              >
                <Flag className="size-5 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{dict.reports.reportMessage}</span>
              </button>
            </li>
          )}
        </ul>
      </div>
    </Modal>
  )

  return (
    <>
      {menu}
      <ReportDialog
        key={reporting ?? 'none'}
        open={reporting !== null}
        onClose={() => setReporting(null)}
        targetType="message"
        targetId={reporting ?? ''}
        title={dict.reports.messageTitle}
        note={dict.reports.reviewNote}
      />
    </>
  )
}
