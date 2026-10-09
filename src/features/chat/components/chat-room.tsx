'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { ChatIcebreakers } from '@/features/icebreakers/components/chat-icebreakers'
import { useCallHistory } from '@/features/calls/components/call-history'
import type { CallEntry } from '@/features/calls/types'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { visibleOutgoing } from '../chat-state'
import { loadMessagesBefore } from '../history-actions'
import { loadReadReceipts } from '../actions'
import { laterOf, LEGACY_RECEIPTS, readBroadcastSchema, type ReadReceipts } from '../read-receipts'
import type { ChatMessage, Reaction } from '../types'
import { ChatComposer, type ComposerPrefill } from './chat-composer'
import type { ComposerMode } from './composer-banner'
import { DeleteDialog } from './delete-dialog'
import { MediaViewer, type ViewerState } from './media-viewer'
import { MessageList } from './message-list'
import { MessageMenu } from './message-menu'
import { ScrollDownButton } from './scroll-down-button'
import { useChatChannel } from './use-chat-channel'
import { useChatMessages } from './use-chat-messages'
import { useFlash } from './use-flash'
import { useMatchTyping } from './use-match-typing'
import { useMessageActions } from './use-message-actions'
import { useReactions } from './use-reactions'
import { useStickToBottom } from './use-stick-to-bottom'

type Props = {
  matchId: string
  viewerId: string
  partnerId: string
  partnerName: string
  initialMessages: ChatMessage[]
  initialReactions: Reaction[]
  initialHasMore: boolean
  initialCalls?: CallEntry[]
  initialReceipts?: ReadReceipts
}

export function ChatRoom({ matchId, viewerId, partnerId, partnerName, ...initial }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [error, setError] = useFlash<ErrorKey>()
  const chat = useChatMessages(matchId, viewerId, initial.initialMessages)
  const calls = useCallHistory(matchId, initial.initialCalls ?? [])
  const reactions = useReactions(matchId, viewerId, initial.initialReactions, setError)
  const { partnerTyping, notifyTyping, clear } = useMatchTyping(matchId, viewerId)
  const [hasMore, setHasMore] = useState(initial.initialHasMore)
  const [loadingEarlier, startLoading] = useTransition()
  const [mode, setMode] = useState<ComposerMode | null>(null)
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [prefill, setPrefill] = useState<ComposerPrefill | null>(null)
  const [receipts, setReceipts] = useState<ReadReceipts>(initial.initialReceipts ?? LEGACY_RECEIPTS)
  const actions = useMessageActions({ chat, reactions, setMode, setViewer, setError })
  // Reply/edit target as currently loaded; dropped once it is deleted (by either side).
  const target = mode && chat.messages.find((m) => m.id === mode.message.id)
  const activeMode = mode && target && !target.deletedAt ? { ...mode, message: target } : null

  const loaded = useMemo(() => new Set(chat.messages.map((m) => m.id)), [chat.messages])
  const outbox = useMemo(() => visibleOutgoing(chat.outbox, loaded), [chat.outbox, loaded])
  const lastOut = outbox.at(-1)
  const last = chat.messages.at(-1)
  const { scrollRef, away, unseen, toBottom } = useStickToBottom(
    lastOut?.tempId ?? last?.id,
    !!lastOut || last?.senderId === viewerId,
    partnerTyping,
  )

  useChatChannel(matchId, {
    onInsert: chat.onInsert,
    onUpdate: chat.onUpdate,
    onReaction: reactions.onRow,
    onReady: () => {
      chat.resync()
      reactions.resync(chat.messages.map((m) => m.id))
      if (receipts.mode === 'gated') void loadReadReceipts(matchId).then(mergeReceipts)
    },
    onRead: (payload) => {
      const read = readBroadcastSchema.safeParse(payload)
      if (!read.success || read.data.reader !== partnerId) return
      setReceipts((r) =>
        r.mode === 'gated' && r.enabled ? { ...r, seenUpTo: laterOf(r.seenUpTo, read.data.at) } : r,
      )
    },
  })

  function mergeReceipts(next: ReadReceipts) {
    setReceipts((r) =>
      next.mode === 'gated' && r.mode === 'gated' && next.enabled
        ? { ...next, seenUpTo: laterOf(r.seenUpTo, next.seenUpTo) }
        : next,
    )
  }

  useEffect(() => {
    if (last && last.senderId !== viewerId) clear()
  }, [last, viewerId, clear])

  // The scroller is anchored to the bottom (column-reverse), so a prepended page keeps the view.
  const loadEarlier = () =>
    startLoading(async () => {
      const oldest = chat.messages[0]
      if (!oldest) return
      const result = await loadMessagesBefore({ matchId, before: oldest.createdAt })
      if (!result.ok) return setError(result.error)
      setError(null)
      chat.prepend(result.data.messages)
      reactions.addLoaded(result.data.reactions)
      setHasMore(result.data.hasMore)
    })

  const menuMessage = actions.menuFor
  const empty = chat.messages.length === 0 && outbox.length === 0 && !hasMore
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col-reverse overflow-x-hidden overflow-y-auto overscroll-contain [overflow-anchor:none]"
      >
        {/* One content box: column-reverse puts the scroll origin at the bottom. */}
        <div className="flex shrink-0 flex-col pt-[var(--header-h)]">
          <MessageList
            messages={chat.messages}
            outbox={outbox}
            calls={calls}
            reactions={reactions.byMessage}
            viewerId={viewerId}
            partnerId={partnerId}
            partnerName={partnerName}
            partnerTyping={partnerTyping}
            receipts={receipts}
            hasMore={hasMore}
            loadingEarlier={loadingEarlier}
            highlightId={actions.highlightId}
            liftedId={menuMessage?.id ?? null}
            fresh={chat.fresh}
            onLoadEarlier={loadEarlier}
            onAction={actions.onBubble}
            onRetry={(id) =>
              void chat.retry(id).then((failed) => failed && setError(failed as ErrorKey))
            }
            onDiscard={chat.discard}
          />
          {empty && (
            <ChatIcebreakers
              matchId={matchId}
              onPick={(text) => setPrefill({ text, at: Date.now() })}
            />
          )}
        </div>
      </div>
      <ChatComposer
        matchId={matchId}
        prefill={prefill}
        mode={activeMode}
        quoteAuthor={activeMode?.message.senderId === viewerId ? dict.chats.yourself : partnerName}
        roomError={errorText(error)}
        aside={<ScrollDownButton visible={away} unseen={unseen} onClick={toBottom} />}
        onCancelMode={() => setMode(null)}
        onSend={chat.send}
        onSent={chat.add}
        onEdited={(id, body, editedAt) => chat.patch(id, { body, editedAt })}
        onTyping={notifyTyping}
      />
      <MessageMenu
        message={menuMessage}
        mine={menuMessage?.senderId === viewerId}
        editable={actions.editable}
        myReaction={
          reactions.byMessage.get(menuMessage?.id ?? '')?.find((r) => r.userId === viewerId)
            ?.emoji ?? null
        }
        onClose={actions.closeMenu}
        onReact={actions.reactFromMenu}
        onAction={actions.onMenu}
      />
      <DeleteDialog
        open={!!actions.deleting}
        pending={actions.deletePending}
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />
      <MediaViewer viewer={viewer} onClose={() => setViewer(null)} />
    </div>
  )
}
