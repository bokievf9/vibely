'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { deleteMessage } from '../message-actions'
import { EDIT_WINDOW_MS, type ChatImage, type ChatMessage, type ReactionEmoji } from '../types'
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
  setPhoto: (image: ChatImage | null) => void
  setError: (error: ErrorKey | undefined) => void
}

// What tapping, swiping and the long-press menu do to a message.
export function useMessageActions({ chat, reactions, setMode, setPhoto, setError }: Deps) {
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
      case 'openImage':
        return setPhoto(m.image)
      case 'imageError':
        return m.image && chat.refreshImage(m.image.path)
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
      chat.patch(m.id, { body: null, image: null, deletedAt: new Date().toISOString() })
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
