import Image from 'next/image'
import Link from 'next/link'
import type { ReportContext } from '../queries/report-context'
import { Badge, BannedBadge, formatDate } from './badges'
import { CallRecordings } from './call-recordings'

const LEFT_REASONS: Record<string, string> = {
  left: 'вышел(а) сам(а)',
  block: 'удалён(а) после блокировки',
  ban: 'удалён(а) после бана',
}

const MESSAGE_KINDS: Record<string, string> = {
  text: 'Текстовое сообщение',
  image: 'Фото в чате',
  voice: 'Голосовое сообщение',
  video: 'Видеосообщение',
}

// Read-only view of the reported thing: content, profile or chat transcript.
export function ReportContextView({ context }: { context: ReportContext | null }) {
  if (!context) return <p className="text-muted text-sm">Объект удалён</p>

  const offender = context.offender && (
    <p className="text-sm">
      <span className="text-muted">Нарушитель: </span>
      <Link href={`/admin/users/${context.offender.id}`} className="font-medium hover:underline">
        {context.offender.name}
      </Link>
    </p>
  )

  switch (context.kind) {
    case 'user':
      return (
        <div className="flex flex-col gap-2">
          {offender}
          {context.banned && <BannedBadge />}
          {context.bio && <p className="text-muted text-sm whitespace-pre-wrap">{context.bio}</p>}
          <CallRecordings calls={context.calls} reportTarget={context.offender.id} />
        </div>
      )
    case 'post':
    case 'comment':
      return (
        <div className="flex flex-col gap-2">
          {offender}
          <blockquote className="border-border rounded-xl border-l-4 bg-black/20 px-3 py-2 break-words whitespace-pre-wrap">
            {context.body}
          </blockquote>
          {context.hidden && (
            <Badge className="self-start bg-red-500/15 text-red-400">Уже скрыт</Badge>
          )}
        </div>
      )
    case 'message':
      return (
        <div className="flex flex-col gap-2">
          {offender}
          <p className="text-muted text-sm">
            {MESSAGE_KINDS[context.mediaKind ?? 'text'] ?? 'Сообщение'}
            {context.sentAt && ` · отправлено ${formatDate(context.sentAt)}`}
            {context.deleted && ' · удалено отправителем'}
          </p>
          <p className="text-muted text-xs">
            Текст сообщения виден в переписке ниже (открытие фиксируется в журнале).
          </p>
          <CallRecordings calls={context.calls} reportTarget={context.offender.id} />
        </div>
      )
    case 'photo':
      return (
        <div className="flex flex-col gap-2">
          {offender}
          {context.url ? (
            <Image
              src={context.url}
              alt={`Фото: ${context.offender.name}`}
              width={context.width}
              height={context.height}
              sizes="240px"
              className="aspect-[3/4] w-40 rounded-xl object-cover"
            />
          ) : (
            <p className="text-muted text-sm">Файл фото недоступен</p>
          )}
        </div>
      )
    case 'call':
      return (
        <div className="flex flex-col gap-2">
          {offender}
          <CallRecordings
            calls={context.call ? [context.call, ...context.calls] : context.calls}
            reportTarget={context.offender.id}
            open
          />
        </div>
      )
    case 'group_message':
      return (
        <div className="flex flex-col gap-2">
          {offender}
          <p className="text-muted text-sm">
            {context.image ? 'Фото в дуо-чате' : 'Сообщение в дуо-чате'}
            {context.sentAt && ` · отправлено ${formatDate(context.sentAt)}`}
          </p>
          <p className="text-muted text-xs">
            Текст сообщения виден в переписке дуо-чата ниже (открытие фиксируется в журнале).
          </p>
        </div>
      )
    case 'group_member':
      return (
        <div className="flex flex-col gap-2">
          {offender}
          <p className="text-muted text-sm">
            Участник дуо-чата
            {context.leftAt &&
              ` · ${LEFT_REASONS[context.leftReason ?? ''] ?? 'вышел(а)'} ${formatDate(context.leftAt)}`}
          </p>
          <p className="text-muted text-xs">
            Переписка дуо-чата открывается ниже (открытие фиксируется в журнале).
          </p>
        </div>
      )
    case 'status':
      return (
        <div className="flex flex-col gap-2">
          {offender}
          <blockquote className="border-border rounded-xl border-l-4 bg-black/20 px-3 py-2 break-words">
            <span aria-hidden className="mr-2">
              {context.emoji}
            </span>
            {context.text}
          </blockquote>
          <p className="text-muted text-sm">
            {context.state === 'removed'
              ? 'Уже удалён'
              : context.state === 'held'
                ? 'Ждёт проверки'
                : `Виден до ${formatDate(context.expiresAt)}`}
            {' · '}
            <Link href="/admin/statuses?filter=reported" className="text-accent hover:underline">
              Одобрить или удалить в разделе «Статусы»
            </Link>
          </p>
        </div>
      )
    case 'random_session':
      return (
        <div className="flex flex-col gap-2">
          {offender}
          <details className="rounded-xl bg-black/20 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">
              Переписка ({context.transcript.length})
            </summary>
            <ol className="mt-2 flex max-h-80 flex-col gap-1.5 overflow-y-auto text-sm">
              {context.transcript.map((m, i) => (
                <li key={i}>
                  <span className="text-muted">{formatDate(m.at)} · </span>
                  <span className="font-medium">{m.from}: </span>
                  <span className="break-words whitespace-pre-wrap">{m.body}</span>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )
  }
}
