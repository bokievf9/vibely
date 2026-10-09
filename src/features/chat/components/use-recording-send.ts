'use client'

import { useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { useUpgradeHandler } from '@/features/plans/components/access-provider'
import { sendMessage } from '../actions'
import { MIN_RECORDING_MS, storedFormat, type RecordKind } from '../media'
import { CHAT_MEDIA_BUCKET, type ChatMessage } from '../types'
import type { Recording } from './use-recorder'

// Same as the chat-media bucket limit (20261008000110).
const MAX_BYTES = 15 * 1024 * 1024

// Voice message / video circle: upload to chat-media/<match id>/<uuid>.<ext> (storage RLS: match
// participants only), then insert the message (counts toward the rate limit).
export function useRecordingSend(matchId: string, onSent: (m: ChatMessage) => void) {
  const [sending, setSending] = useState(false)
  const upgradeOr = useUpgradeHandler()

  const send = async (
    kind: RecordKind,
    rec: Recording | null,
    replyTo: string | null,
  ): Promise<ErrorKey | null> => {
    if (!rec || rec.durationMs < MIN_RECORDING_MS) return null
    const format = storedFormat(kind, rec.mime)
    if (!format) return 'recordingUnsupported'
    if (rec.blob.size > MAX_BYTES) return 'invalidFile'
    setSending(true)
    try {
      const path = `${matchId}/${crypto.randomUUID()}.${format.ext}`
      const { error } = await getBrowserClient()
        .storage.from(CHAT_MEDIA_BUCKET)
        .upload(path, rec.blob, { contentType: format.mime })
      if (error) return 'mediaSendFailed'
      const durationMs = Math.max(1, rec.durationMs)
      const result = await sendMessage({
        matchId,
        replyTo,
        recording:
          kind === 'voice'
            ? {
                kind,
                path,
                mime: format.mime === 'audio/mp4' ? 'audio/mp4' : 'audio/webm',
                durationMs,
                waveform: rec.waveform?.length ? rec.waveform : null,
              }
            : {
                kind,
                path,
                mime: format.mime === 'video/mp4' ? 'video/mp4' : 'video/webm',
                durationMs,
              },
      })
      if (!result.ok) return upgradeOr(result) ? null : result.error
      onSent(result.data)
      return null
    } catch {
      return 'mediaSendFailed'
    } finally {
      setSending(false)
    }
  }

  return { sending, send }
}
