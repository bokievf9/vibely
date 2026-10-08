'use client'

import { useState } from 'react'
import { prepareImage } from '@/lib/image'
import { getBrowserClient } from '@/lib/supabase/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { sendMessage } from '../actions'
import { CHAT_MEDIA_BUCKET, type ChatMessage } from '../types'

const MAX_SOURCE_BYTES = 25 * 1024 * 1024

// Photo message: compress to WebP in the browser, upload to chat-media/<match id>/<uuid>.webp
// (storage RLS: match participants only), then insert the message (counts toward the rate limit).
export function usePhotoSend(matchId: string, onSent: (m: ChatMessage) => void) {
  const [sending, setSending] = useState(false)

  const send = async (source: File, replyTo: string | null): Promise<ErrorKey | null> => {
    if (!source.type.startsWith('image/') || source.size > MAX_SOURCE_BYTES) return 'invalidFile'
    setSending(true)
    try {
      const { file, width, height } = await prepareImage(source)
      const path = `${matchId}/${crypto.randomUUID()}.webp`
      const { error } = await getBrowserClient()
        .storage.from(CHAT_MEDIA_BUCKET)
        .upload(path, file, { contentType: 'image/webp' })
      if (error) return 'photoSendFailed'
      const result = await sendMessage({ matchId, replyTo, image: { path, width, height } })
      if (!result.ok) return result.error
      onSent(result.data)
      return null
    } catch {
      return 'photoSendFailed'
    } finally {
      setSending(false)
    }
  }

  return { sending, send }
}
