'use client'

import { useEffect, useState, useTransition } from 'react'
import { FormError } from '@/components/ui/field'
import { useErrorText } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { loadMessagesBefore } from '../actions'
import type { ChatMessage } from '../types'
import { ChatComposer } from './chat-composer'
import { MessageList } from './message-list'
import { useChatMessages } from './use-chat-messages'
import { useMatchTyping } from './use-match-typing'

type Props = {
  matchId: string
  viewerId: string
  partnerName: string
  initialMessages: ChatMessage[]
  initialHasMore: boolean
}

export function ChatRoom({
  matchId,
  viewerId,
  partnerName,
  initialMessages,
  initialHasMore,
}: Props) {
  const errorText = useErrorText()
  const { messages, add, prepend } = useChatMessages(matchId, viewerId, initialMessages)
  const { partnerTyping, notifyTyping, clear } = useMatchTyping(matchId, viewerId)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [error, setError] = useState<ErrorKey>()
  const [loadingEarlier, startLoading] = useTransition()

  const last = messages.at(-1)
  useEffect(() => {
    if (last && last.senderId !== viewerId) clear()
  }, [last, viewerId, clear])

  const loadEarlier = () =>
    startLoading(async () => {
      const oldest = messages[0]
      if (!oldest) return
      const result = await loadMessagesBefore({ matchId, before: oldest.createdAt })
      if (!result.ok) return setError(result.error)
      setError(undefined)
      prepend(result.data.messages)
      setHasMore(result.data.hasMore)
    })

  return (
    <div className="flex flex-1 flex-col">
      <FormError message={errorText(error)} />
      <MessageList
        messages={messages}
        viewerId={viewerId}
        partnerName={partnerName}
        partnerTyping={partnerTyping}
        hasMore={hasMore}
        loadingEarlier={loadingEarlier}
        onLoadEarlier={loadEarlier}
      />
      <ChatComposer matchId={matchId} onSent={add} onTyping={notifyTyping} />
    </div>
  )
}
