'use client'

import { useEffect, useState, useTransition } from 'react'
import { FormError } from '@/components/ui/field'
import { ChatIcebreakers } from '@/features/icebreakers/components/chat-icebreakers'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { loadMessagesBefore } from '../history-actions'
import type { ChatImage, ChatMessage, Reaction } from '../types'
import { ChatComposer, type ComposerPrefill } from './chat-composer'
import type { ComposerMode } from './composer-banner'
import { MessageList } from './message-list'
import { PhotoViewer } from './photo-viewer'
import { ScrollDownButton } from './scroll-down-button'
import { useChatChannel } from './use-chat-channel'
import { useChatMessages } from './use-chat-messages'
import { useMatchTyping } from './use-match-typing'
import { useMessageActions } from './use-message-actions'
import { useReactions } from './use-reactions'
import { useStickToBottom } from './use-stick-to-bottom'
import { MessageMenu } from './message-menu'
import { DeleteDialog } from './delete-dialog'

type Props = {
  matchId: string
  viewerId: string
  partnerName: string
  initialMessages: ChatMessage[]
  initialReactions: Reaction[]
  initialHasMore: boolean
}

export function ChatRoom({ matchId, viewerId, partnerName, ...initial }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [error, setError] = useState<ErrorKey>()
  const chat = useChatMessages(matchId, viewerId, initial.initialMessages)
  const reactions = useReactions(matchId, viewerId, initial.initialReactions, setError)
  const { partnerTyping, notifyTyping, clear } = useMatchTyping(matchId, viewerId)
  const scroll = useStickToBottom(chat.messages, viewerId, partnerTyping)
  const [hasMore, setHasMore] = useState(initial.initialHasMore)
  const [loadingEarlier, startLoading] = useTransition()
  const [mode, setMode] = useState<ComposerMode | null>(null)
  const [photo, setPhoto] = useState<ChatImage | null>(null)
  const [prefill, setPrefill] = useState<ComposerPrefill | null>(null)
  const actions = useMessageActions({ chat, reactions, setMode, setPhoto, setError })
  // Reply/edit target as currently loaded; dropped once it is deleted (by either side).
  const target = mode && chat.messages.find((m) => m.id === mode.message.id)
  const activeMode = mode && target && !target.deletedAt ? { ...mode, message: target } : null

  useChatChannel(matchId, {
    onInsert: chat.onInsert,
    onUpdate: chat.onUpdate,
    onReaction: reactions.onRow,
    onReady: () => {
      chat.resync()
      reactions.resync(chat.messages.map((m) => m.id))
    },
  })

  const last = chat.messages.at(-1)
  useEffect(() => {
    if (last && last.senderId !== viewerId) clear()
  }, [last, viewerId, clear])

  const loadEarlier = () =>
    startLoading(async () => {
      const oldest = chat.messages[0]
      if (!oldest) return
      const result = await loadMessagesBefore({ matchId, before: oldest.createdAt })
      if (!result.ok) return setError(result.error)
      setError(undefined)
      scroll.keepAnchor()
      chat.prepend(result.data.messages)
      reactions.addLoaded(result.data.reactions)
      setHasMore(result.data.hasMore)
    })

  const menuMessage = actions.menuFor
  return (
    <div className="flex flex-1 flex-col">
      <FormError message={errorText(error)} />
      <MessageList
        messages={chat.messages}
        reactions={reactions.byMessage}
        viewerId={viewerId}
        partnerName={partnerName}
        partnerTyping={partnerTyping}
        hasMore={hasMore}
        loadingEarlier={loadingEarlier}
        highlightId={actions.highlightId}
        bottomRef={scroll.bottomRef}
        onLoadEarlier={loadEarlier}
        onAction={actions.onBubble}
      />
      {chat.messages.length === 0 && !hasMore && (
        <ChatIcebreakers
          matchId={matchId}
          onPick={(text) => setPrefill({ text, at: Date.now() })}
        />
      )}
      <ChatComposer
        matchId={matchId}
        prefill={prefill}
        mode={activeMode}
        quoteAuthor={activeMode?.message.senderId === viewerId ? dict.chats.yourself : partnerName}
        aside={
          <ScrollDownButton
            visible={scroll.away}
            unseen={scroll.unseen}
            onClick={scroll.toBottom}
          />
        }
        onCancelMode={() => setMode(null)}
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
      <PhotoViewer image={photo} onClose={() => setPhoto(null)} />
    </div>
  )
}
