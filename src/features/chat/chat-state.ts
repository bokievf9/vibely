// Pure helpers for the live chat state. Dependency-free (relative type imports only), so they are
// unit-tested with `node --test` (tests/unit/chat-state.test.mjs).
import type { ChatMessage, Reaction } from './types'

const byTime = (a: ChatMessage, b: ChatMessage) => a.createdAt.localeCompare(b.createdAt)

// A Realtime row has no signed URL or quoted-message preview: keep the ones already loaded.
function combine(old: ChatMessage, next: ChatMessage): ChatMessage {
  const image =
    next.image && !next.image.url && old.image?.path === next.image.path
      ? { ...next.image, url: old.image.url }
      : next.image
  return { ...next, image, reply: next.reply ?? (next.replyTo ? old.reply : null) }
}

// Inserts new messages and updates known ones, oldest first.
export function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (!incoming.length) return prev
  const fresh = new Map(incoming.map((m) => [m.id, m]))
  const kept = prev.map((p) => {
    const next = fresh.get(p.id)
    return next ? combine(p, next) : p
  })
  const seen = new Set(prev.map((p) => p.id))
  const added = incoming.filter((m) => !seen.has(m.id))
  return added.length ? [...kept, ...added].sort(byTime) : kept
}

// Sets, replaces or (emoji null) removes one user's reaction on a message.
export function applyReaction(
  list: Reaction[],
  change: { messageId: string; userId: string; emoji: Reaction['emoji'] | null },
): Reaction[] {
  const rest = list.filter((r) => r.messageId !== change.messageId || r.userId !== change.userId)
  return change.emoji
    ? [...rest, { messageId: change.messageId, userId: change.userId, emoji: change.emoji }]
    : rest
}

export type ListItem<M> =
  | { kind: 'day'; key: string; at: string }
  | { kind: 'message'; message: M; groupStart: boolean; groupEnd: boolean }

type Groupable = { id: string; senderId: string; createdAt: string }

const GROUP_GAP_MS = 10 * 60 * 1000

// Day separators plus Telegram-style grouping: consecutive messages of one sender on the same
// day, less than 10 minutes apart, form a group (the bubble tail goes on the last one).
export function groupMessages<M extends Groupable>(
  messages: M[],
  dayOf: (iso: string) => string,
): ListItem<M>[] {
  const items: ListItem<M>[] = []
  const days = messages.map((m) => dayOf(m.createdAt))
  const joins = (a: number, b: number) => {
    const x = messages[a]
    const y = messages[b]
    return (
      !!x &&
      !!y &&
      x.senderId === y.senderId &&
      days[a] === days[b] &&
      Date.parse(y.createdAt) - Date.parse(x.createdAt) < GROUP_GAP_MS
    )
  }
  messages.forEach((message, i) => {
    const day = days[i] ?? ''
    if (i === 0 || days[i - 1] !== day) items.push({ kind: 'day', key: day, at: message.createdAt })
    items.push({
      kind: 'message',
      message,
      groupStart: !joins(i - 1, i),
      groupEnd: !joins(i, i + 1),
    })
  })
  return items
}
