'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { applyReaction } from '../chat-state'
import { loadReactions } from '../history-actions'
import { reactToMessage } from '../message-actions'
import { toReaction, type ReactionRow } from '../message-row'
import type { Reaction, ReactionEmoji } from '../types'

const RESYNC_IDS = 200

// Reactions of the loaded messages. Own taps apply optimistically; Realtime rows (INSERT/UPDATE,
// emoji null = removed) keep both sides in sync.
export function useReactions(
  matchId: string,
  viewerId: string,
  initial: Reaction[],
  onError: (e: ErrorKey) => void,
) {
  const [reactions, setReactions] = useState(initial)
  const [, startTransition] = useTransition()

  const byMessage = useMemo(() => {
    const map = new Map<string, Reaction[]>()
    for (const r of reactions) map.set(r.messageId, [...(map.get(r.messageId) ?? []), r])
    return map
  }, [reactions])

  const onRow = (row: ReactionRow) =>
    setReactions((prev) =>
      applyReaction(prev, {
        messageId: row.message_id,
        userId: row.user_id,
        emoji: toReaction(row)?.emoji ?? null,
      }),
    )

  // Same emoji again removes it; another one replaces it.
  const toggle = (messageId: string, emoji: ReactionEmoji) => {
    const mine = reactions.find((r) => r.messageId === messageId && r.userId === viewerId)
    const next = mine?.emoji === emoji ? null : emoji
    const previous = reactions
    setReactions((prev) => applyReaction(prev, { messageId, userId: viewerId, emoji: next }))
    startTransition(async () => {
      const result = await reactToMessage({ messageId, emoji: next })
      if (result.ok) return
      setReactions(previous)
      onError(result.error)
    })
  }

  const addLoaded = (more: Reaction[]) =>
    setReactions((prev) => more.reduce((list, r) => applyReaction(list, r), prev))

  // Replaces the reactions of the given (most recent) messages with the server's state.
  const resync = (messageIds: string[]) => {
    const ids = messageIds.slice(-RESYNC_IDS)
    void loadReactions({ matchId, ids }).then((fresh) => {
      const scope = new Set(ids)
      setReactions((prev) => [...prev.filter((r) => !scope.has(r.messageId)), ...fresh])
    })
  }

  return { byMessage, onRow, toggle, addLoaded, resync }
}
