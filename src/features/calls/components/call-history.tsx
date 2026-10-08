'use client'

import { useCallback, useEffect, useState } from 'react'
import { PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { formatTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { loadCallHistory } from '../settings-actions'
import { formatCallDuration } from '../timeline'
import type { CallEntry } from '../types'
import { onCallHistory } from './call-signal'

// Call entries of one chat, refreshed whenever a call of this match changes state.
export function useCallHistory(matchId: string, initial: CallEntry[]) {
  const [calls, setCalls] = useState(initial)
  const refresh = useCallback(async () => {
    const result = await loadCallHistory(matchId)
    if (result.ok) setCalls(result.data)
  }, [matchId])
  useEffect(
    () =>
      onCallHistory((d) => {
        if (!d.matchId || d.matchId === matchId) void refresh()
      }),
    [matchId, refresh],
  )
  return calls
}

function label(call: CallEntry, t: Dictionary['calls']['history']) {
  const missed = call.status === 'missed'
  if (call.status === 'ringing' || call.status === 'active') return t.ongoing
  if (missed) return call.outgoing ? t.noAnswer : call.kind === 'video' ? t.missedVideo : t.missed
  if (call.status === 'declined') return call.outgoing ? t.declinedByPartner : t.declinedByMe
  const name = call.kind === 'video' ? t.video : t.audio
  return call.durationSec !== null ? `${name} · ${formatCallDuration(call.durationSec)}` : name
}

// "Missed call", "Video call · 5:12": a centered row in the chat timeline.
export function CallHistoryRow({ call }: { call: CallEntry }) {
  const { dict, locale } = useI18n()
  const missed = call.status === 'missed' && !call.outgoing
  const Icon =
    call.kind === 'video'
      ? Video
      : missed
        ? PhoneMissed
        : call.outgoing
          ? PhoneOutgoing
          : PhoneIncoming
  return (
    <li className="my-2 flex justify-center">
      <span
        className={cn(
          'bg-surface flex items-center gap-2 rounded-full px-3 py-1.5 text-sm',
          missed ? 'text-danger' : 'text-muted',
        )}
      >
        <Icon className="size-4" aria-hidden />
        {label(call, dict.calls.history)}
        <time dateTime={call.startedAt} className="text-xs opacity-70">
          {formatTime(call.startedAt, locale)}
        </time>
      </span>
    </li>
  )
}
