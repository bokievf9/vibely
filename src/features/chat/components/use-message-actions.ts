'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { deleteMessage } from '../message-actions'
import { EDIT_WINDOW_MS, type ChatMessage, type ReactionEmoji } from '../types'
import type { ViewerState } from './media-viewer'
import type { BubbleAction } from './message-bubble'
import type { ComposerMode } from './composer-banner'
import type { MenuAction } from './message-menu'
import type { useChatMessages } from './use-chat-messages'
import type { useReactions } from './use-reactions'

const HIGHLIGHT_MS = 1_500

type Deps = {
  chat: ReturnType<typeof useChatMessages>
  reactions: ReturnType<typeof useReactions>
  setMode: (mode: ComposerMode | null) => void
  setViewer: (viewer: ViewerState | null) => void
  setError: (error: ErrorKey | undefined) => void
}

// What tapping, swiping and the long-press menu do to a message.
export function useMessageActions({ chat, reactions, setMode, setViewer, setError }: Deps) {
  const [menuFor, setMenuFor] = useState<ChatMessage | null>(null)
  const [editable, setEditable] = useState(false)
  const [deleting, setDeleting] = useState<ChatMessage | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [deletePending, startDelete] = useTransition()
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(highlightTimer.current), [])

  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(id)
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS)
  }

  const onBubble = (m: ChatMessage, action: BubbleAction) => {
    switch (action.type) {
      case 'reply':
        return setMode({ kind: 'reply', message: m })
      case 'menu':
        setEditable(Date.now() - Date.parse(m.createdAt) < EDIT_WINDOW_MS)
        return setMenuFor(m)
      case 'openMedia':
        return m.media?.kind === 'image' || m.media?.kind === 'video'
          ? setViewer({ media: m.media, origin: action.origin, messageId: m.id })
          : undefined
      case 'mediaError':
        return m.media && chat.refreshMedia(m.media.path)
      case 'react':
        return reactions.toggle(m.id, action.emoji)
      case 'jump':
        return jumpTo(action.id)
    }
  }

  const onMenu = (action: MenuAction) => {
    const m = menuFor
    setMenuFor(null)
    if (!m) return
    if (action === 'reply' || action === 'edit') setMode({ kind: action, message: m })
    else if (action === 'copy' && m.body) void navigator.clipboard?.writeText(m.body)
    else if (action === 'delete') setDeleting(m)
  }

  const reactFromMenu = (emoji: ReactionEmoji) => {
    if (menuFor) reactions.toggle(menuFor.id, emoji)
    setMenuFor(null)
  }

  const confirmDelete = () =>
    startDelete(async () => {
      const m = deleting
      if (!m) return
      const result = await deleteMessage(m.id)
      setDeleting(null)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      chat.patch(m.id, { body: null, media: null, deletedAt: new Date().toISOString() })
    })

  return {
    menuFor,
    editable,
    deleting,
    deletePending,
    highlightId,
    onBubble,
    onMenu,
    reactFromMenu,
    closeMenu: () => setMenuFor(null),
    cancelDelete: () => setDeleting(null),
    confirmDelete,
  }
}
