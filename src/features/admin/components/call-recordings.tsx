'use client'

import { useState, useTransition } from 'react'
import { ExternalLink, Phone, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { formatCallDuration } from '@/features/calls/timeline'
import { openCallRecording } from '../call-recording-actions'
import type { ReportCall } from '../queries/call-recordings'
import { formatDate } from './badges'

const STATUS: Record<ReportCall['status'], string> = {
  ringing: 'идёт вызов',
  active: 'идёт разговор',
  ended: 'завершён',
  missed: 'пропущен',
  declined: 'отклонён',
}

const RECORDING: Record<ReportCall['recording'], string> = {
  none: 'нет записи',
  pending: 'запись запускается',
  recording: 'идёт запись',
  ready: 'запись готова',
  failed: 'запись не удалась',
  purged: 'запись удалена (90 дней)',
}

// Calls between the reported user and the reporter(s). Opening a recording is logged and gives a
// link valid for a few minutes; it opens in a new tab with the browser's own player.
export function CallRecordings({
  calls,
  reportTarget,
}: {
  calls: ReportCall[]
  reportTarget: string
}) {
  const [links, setLinks] = useState<Record<string, string>>({})
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  if (!calls.length) return null

  const open = (callId: string) =>
    startTransition(async () => {
      const result = await openCallRecording({ callId, reportTarget })
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setLinks((l) => ({ ...l, [callId]: result.data.url }))
    })

  return (
    <details className="rounded-xl bg-black/20 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">Звонки ({calls.length})</summary>
      <p className="text-muted mt-2 text-xs">
        Каждое открытие записи фиксируется в журнале модерации. Ссылка действует 5 минут.
      </p>
      <ul className="mt-2 flex flex-col gap-2 text-sm">
        {calls.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2">
            {c.kind === 'video' ? <Video className="size-4" /> : <Phone className="size-4" />}
            <span>{formatDate(c.startedAt)}</span>
            <span className="text-muted">
              · {STATUS[c.status]}
              {c.durationSec !== null && ` · ${formatCallDuration(c.durationSec)}`} ·{' '}
              {RECORDING[c.recording]}
            </span>
            {c.recording === 'ready' &&
              (links[c.id] ? (
                <a
                  href={links[c.id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent inline-flex items-center gap-1 underline"
                >
                  <ExternalLink className="size-4" /> Открыть
                </a>
              ) : (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => open(c.id)}>
                  Получить ссылку
                </Button>
              ))}
          </li>
        ))}
      </ul>
      <FormError message={error} />
    </details>
  )
}
