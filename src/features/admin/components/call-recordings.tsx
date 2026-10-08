'use client'

import { useState, useTransition } from 'react'
import { ExternalLink, Phone, Play, Video } from 'lucide-react'
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
// link valid for a few minutes, played inline (the new-tab link stays as a fallback, e.g. when the
// recordings bucket is not allowed by the page's media CSP).
export function CallRecordings({
  calls,
  reportTarget,
  open: initiallyOpen = false,
}: {
  calls: ReportCall[]
  reportTarget: string
  open?: boolean
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
    <details open={initiallyOpen} className="rounded-xl bg-black/20 px-3 py-2">
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
            {c.recording === 'ready' && !links[c.id] && (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => open(c.id)}>
                <Play className="size-4" /> Прослушать
              </Button>
            )}
            {links[c.id] && <RecordingPlayer kind={c.kind} url={links[c.id] ?? ''} />}
          </li>
        ))}
      </ul>
      <FormError message={error} />
    </details>
  )
}

function RecordingPlayer({ kind, url }: { kind: ReportCall['kind']; url: string }) {
  return (
    <div className="flex w-full flex-col gap-1">
      {kind === 'video' ? (
        <video controls playsInline src={url} className="max-h-72 w-full rounded-lg bg-black">
          <track kind="captions" />
        </video>
      ) : (
        <audio controls src={url} className="w-full">
          <track kind="captions" />
        </audio>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted inline-flex items-center gap-1 self-start text-xs underline"
      >
        <ExternalLink className="size-3" /> Не играет? Открыть в новой вкладке
      </a>
    </div>
  )
}
