'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { MessagesSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { openGroupMedia, openGroupTranscript } from '../evidence-actions'
import { systemEventText, type GroupTranscript } from '../group-evidence'
import type { ReportTarget } from '../report-labels'
import { Badge, formatDate } from './badges'

type Party = { id: string; name: string }

// Duo Dating group chat (4 people) as seen by each reporter, opened on demand. The database
// checks the open report and logs every opening and every photo (CLAUDE.md safety protocol).
export function GroupEvidencePanel({
  targetType,
  targetId,
  offender,
  reporters,
}: {
  targetType: ReportTarget
  targetId: string
  offender: Party
  reporters: Party[]
}) {
  if (!reporters.length) return null
  return (
    <div className="flex flex-col gap-2">
      {reporters.map((r) => (
        <GroupTranscriptView
          key={r.id}
          targetType={targetType}
          targetId={targetId}
          offender={offender}
          reporter={r}
        />
      ))}
    </div>
  )
}

function GroupTranscriptView({
  targetType,
  targetId,
  offender,
  reporter,
}: {
  targetType: ReportTarget
  targetId: string
  offender: Party
  reporter: Party
}) {
  const [transcript, setTranscript] = useState<GroupTranscript | null>(null)
  const [media, setMedia] = useState<Record<string, string>>({})
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const evidence = { targetType, targetId, reporterId: reporter.id }
  const anchorId = `group-evidence-${targetId}-${reporter.id}-reported`

  const load = () =>
    startTransition(async () => {
      const result = await openGroupTranscript(evidence)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setTranscript(result.data)
      requestAnimationFrame(() =>
        document.getElementById(anchorId)?.scrollIntoView({ block: 'center' }),
      )
    })

  const loadMedia = (messageId: string) =>
    startTransition(async () => {
      const result = await openGroupMedia({ ...evidence, messageId })
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setMedia((m) => ({ ...m, [messageId]: result.data.url }))
    })

  const members = new Map(transcript?.members.map((m) => [m.id, m]))
  const nameOf = (id: string | null) => (id ? (members.get(id)?.name ?? '—') : '—')

  return (
    <div className="rounded-xl bg-black/20 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          Переписка дуо-чата (жалоба от {reporter.name})
          {transcript && ` (${transcript.messages.length})`}
        </span>
        {!transcript && (
          <Button size="sm" variant="secondary" loading={pending} onClick={load}>
            <MessagesSquare className="size-4" /> Открыть
          </Button>
        )}
      </div>
      {!transcript && (
        <p className="text-muted mt-1 text-xs">
          Групповой чат двух дуо (4 человека). Доступ фиксируется в журнале модерации. До 300
          сообщений вокруг жалобы.
        </p>
      )}
      {transcript && (
        <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {transcript.members.map((m) => (
            <li key={m.id}>
              <Badge
                className={cn(
                  m.id === offender.id ? 'bg-red-500/15 text-red-300' : 'bg-border text-muted',
                )}
              >
                {m.name}
                {m.id === reporter.id && ' (заявитель)'}
                {m.id === offender.id && ' (нарушитель)'}
                {m.left && ' · вышел(а)'}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {transcript && !transcript.messages.length && (
        <p className="text-muted mt-2 text-sm">Сообщений нет</p>
      )}
      {transcript && transcript.messages.length > 0 && (
        <ol className="mt-2 flex max-h-96 flex-col gap-1.5 overflow-y-auto text-sm">
          {transcript.messages.map((m) => (
            <li
              key={m.id}
              id={m.reported ? anchorId : undefined}
              className={cn(
                'rounded-lg px-2 py-1',
                m.reported && 'bg-red-500/15 ring-1 ring-red-500/40',
              )}
            >
              <span className="text-muted">{formatDate(m.createdAt)} · </span>
              {m.kind === 'system' ? (
                <span className="text-muted italic">
                  {systemEventText(m.systemEvent, m.aboutUser ? nameOf(m.aboutUser) : null)}
                </span>
              ) : (
                <>
                  <span className={cn('font-medium', m.senderId === offender.id && 'text-red-300')}>
                    {nameOf(m.senderId)}:{' '}
                  </span>
                  {m.body && <span className="break-words whitespace-pre-wrap">{m.body}</span>}
                  {m.kind === 'image' && (
                    <PhotoSlot
                      available={m.hasMedia}
                      url={media[m.id]}
                      pending={pending}
                      onOpen={() => loadMedia(m.id)}
                    />
                  )}
                </>
              )}
              {m.reported && (
                <Badge className="ml-1 bg-red-600 align-middle text-white">жалоба</Badge>
              )}
            </li>
          ))}
        </ol>
      )}
      <FormError message={error} />
    </div>
  )
}

function PhotoSlot({
  available,
  url,
  pending,
  onOpen,
}: {
  available: boolean
  url: string | undefined
  pending: boolean
  onOpen: () => void
}) {
  if (!available) return <span className="text-muted">[Фото: удалено (90 дней)]</span>
  if (!url)
    return (
      <Button size="sm" variant="ghost" className="h-7 px-2" disabled={pending} onClick={onOpen}>
        [Фото: показать]
      </Button>
    )
  return (
    <Image
      src={url}
      alt="Фото из дуо-чата"
      width={320}
      height={320}
      unoptimized
      className="mt-1 max-h-64 w-auto rounded-lg object-contain"
    />
  )
}
