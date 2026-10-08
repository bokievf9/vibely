'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { MessagesSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { openChatMedia, openTranscript, type TranscriptMessage } from '../evidence-actions'
import type { ReportTarget } from '../report-labels'
import { Badge, formatDate } from './badges'

type Party = { id: string; name: string }
type Media = { url: string; kind: 'image' | 'voice' | 'video'; mime: string }

const MEDIA_LABELS: Record<NonNullable<TranscriptMessage['mediaKind']>, string> = {
  image: 'Фото',
  voice: 'Голосовое',
  video: 'Видео',
}

// Chat between each reporter and the reported person, opened on demand. Every opening (and every
// media file) is checked against the open report and logged by the database.
export function EvidencePanel({
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
        <Transcript
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

function Transcript({
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
  const [messages, setMessages] = useState<TranscriptMessage[] | null>(null)
  const [media, setMedia] = useState<Record<string, Media>>({})
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const evidence = { targetType, targetId, reporterId: reporter.id }

  const load = () =>
    startTransition(async () => {
      const result = await openTranscript(evidence)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setMessages(result.data)
      // Bring the reported message into view once the list is rendered.
      requestAnimationFrame(() =>
        document
          .getElementById(`evidence-${targetId}-${reporter.id}-reported`)
          ?.scrollIntoView({ block: 'center' }),
      )
    })

  const loadMedia = (messageId: string) =>
    startTransition(async () => {
      const result = await openChatMedia({ ...evidence, messageId })
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setMedia((m) => ({ ...m, [messageId]: result.data }))
    })

  const nameOf = (id: string) =>
    id === offender.id ? offender.name : id === reporter.id ? reporter.name : '—'

  return (
    <div className="rounded-xl bg-black/20 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          Переписка: {reporter.name} и {offender.name}
          {messages && ` (${messages.length})`}
        </span>
        {!messages && (
          <Button size="sm" variant="secondary" loading={pending} onClick={load}>
            <MessagesSquare className="size-4" /> Открыть
          </Button>
        )}
      </div>
      {!messages && (
        <p className="text-muted mt-1 text-xs">
          Доступ фиксируется в журнале модерации. Последние 300 сообщений вокруг жалобы, включая
          удалённые.
        </p>
      )}
      {messages && !messages.length && (
        <p className="text-muted mt-2 text-sm">Сообщений между ними нет</p>
      )}
      {messages && messages.length > 0 && (
        <ol className="mt-2 flex max-h-96 flex-col gap-1.5 overflow-y-auto text-sm">
          {messages.map((m) => (
            <li
              key={m.id}
              id={m.reported ? `evidence-${targetId}-${reporter.id}-reported` : undefined}
              className={cn(
                'rounded-lg px-2 py-1',
                m.reported && 'bg-red-500/15 ring-1 ring-red-500/40',
                m.deleted && 'opacity-80',
              )}
            >
              <span className="text-muted">{formatDate(m.createdAt)} · </span>
              <span className={cn('font-medium', m.senderId === offender.id && 'text-red-300')}>
                {nameOf(m.senderId)}:{' '}
              </span>
              {m.body && <span className="break-words whitespace-pre-wrap">{m.body}</span>}
              {m.mediaKind && (
                <MediaSlot
                  kind={m.mediaKind}
                  available={m.hasMedia}
                  media={media[m.id]}
                  pending={pending}
                  onOpen={() => loadMedia(m.id)}
                />
              )}
              <span className="ml-1 inline-flex gap-1 align-middle">
                {m.reported && <Badge className="bg-red-600 text-white">жалоба</Badge>}
                {m.deleted && (
                  <Badge className="bg-amber-500/15 text-amber-400">удалено для всех</Badge>
                )}
                {m.unmatched && <Badge className="bg-border text-muted">из архива</Badge>}
                {m.edited && <Badge className="bg-border text-muted">изменено</Badge>}
              </span>
            </li>
          ))}
        </ol>
      )}
      <FormError message={error} />
    </div>
  )
}

function MediaSlot({
  kind,
  available,
  media,
  pending,
  onOpen,
}: {
  kind: NonNullable<TranscriptMessage['mediaKind']>
  available: boolean
  media: Media | undefined
  pending: boolean
  onOpen: () => void
}) {
  if (!available)
    return <span className="text-muted">[{MEDIA_LABELS[kind]}: удалено (90 дней)]</span>
  if (!media)
    return (
      <Button size="sm" variant="ghost" className="h-7 px-2" disabled={pending} onClick={onOpen}>
        [{MEDIA_LABELS[kind]}: показать]
      </Button>
    )
  if (media.kind === 'image')
    return (
      <Image
        src={media.url}
        alt="Фото из чата"
        width={320}
        height={320}
        unoptimized
        className="mt-1 max-h-64 w-auto rounded-lg object-contain"
      />
    )
  if (media.kind === 'voice')
    return (
      <audio controls src={media.url} className="mt-1 w-full max-w-xs">
        <track kind="captions" />
      </audio>
    )
  return (
    <video controls playsInline src={media.url} className="mt-1 max-h-64 rounded-lg">
      <track kind="captions" />
    </video>
  )
}
