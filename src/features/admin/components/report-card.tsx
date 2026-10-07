'use client'

import { useState } from 'react'
import { Ban, EyeOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { resolveReports } from '../actions'
import type { ReportGroup } from '../queries/reports'
import { formatDate } from './badges'
import { ReasonDialog } from './reason-dialog'
import { ReportContextView } from './report-context-view'
import { useModeration } from './use-moderation'

const TARGET_LABELS: Record<ReportGroup['targetType'], string> = {
  user: 'Профиль',
  post: 'Пост',
  comment: 'Комментарий',
  random_session: 'Рандом-чат',
}

// Users submit a reason code ("fake: optional details"); show it in Russian for moderators.
const REASON_CODES: Record<string, string> = {
  fake: 'Фейковый профиль',
  harassment: 'Оскорбления',
  spam: 'Спам или реклама',
  sexual: 'Сексуальный контент',
  scam: 'Мошенничество',
  underage: 'Младше 18 лет',
}

function readableReason(reason: string) {
  const [code = '', ...rest] = reason.split(': ')
  const label = REASON_CODES[code]
  return label ? [label, rest.join(': ')].filter(Boolean).join(': ') : reason
}

const PRESETS = [
  'Оскорбления',
  'Спам или реклама',
  'Сексуальный контент',
  'Мошенничество',
  'Фейковый профиль',
  'Угрозы',
]

export function ReportCard({ group }: { group: ReportGroup }) {
  const { pending, error, run } = useModeration()
  const [dialog, setDialog] = useState<'hide' | 'ban' | null>(null)
  const { targetType, targetId, context } = group
  const canHide =
    (targetType === 'post' || targetType === 'comment') &&
    context &&
    'hidden' in context &&
    !context.hidden
  const offenderId = context?.offender?.id

  const decide = async (decision: 'hide' | 'ban', reason: string) => {
    const ok = await run(() =>
      decision === 'ban' && offenderId
        ? resolveReports({ decision, targetType, targetId, offenderId, reason })
        : resolveReports({
            decision: 'hide',
            targetType: targetType as 'post' | 'comment',
            targetId,
            reason,
          }),
    )
    if (ok) setDialog(null)
  }

  return (
    <article className="bg-surface flex flex-col gap-4 rounded-3xl p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">
          {TARGET_LABELS[targetType]} · {group.reasons.length} жалоб(ы)
        </h2>
        <time className="text-muted text-sm" dateTime={group.firstReportedAt}>
          {formatDate(group.firstReportedAt)}
        </time>
      </header>
      <ReportContextView context={context} />
      <ul className="flex flex-col gap-1 text-sm">
        {group.reasons.map((r) => (
          <li key={r.reporterId}>
            <span className="text-muted">{r.reporterName}: </span>
            {readableReason(r.reason)}
          </li>
        ))}
      </ul>
      <FormError message={dialog ? undefined : error} />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={pending && !dialog}
          onClick={() => run(() => resolveReports({ decision: 'dismiss', targetType, targetId }))}
        >
          <X className="size-4" /> Отклонить
        </Button>
        {canHide && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setDialog('hide')}
            disabled={pending}
          >
            <EyeOff className="size-4" /> Скрыть
          </Button>
        )}
        {offenderId && (
          <Button size="sm" variant="danger" onClick={() => setDialog('ban')} disabled={pending}>
            <Ban className="size-4" /> Заблокировать
          </Button>
        )}
      </div>
      <ReasonDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog === 'ban' ? `Заблокировать ${context?.offender?.name ?? ''}` : 'Скрыть контент'
        }
        confirmLabel={dialog === 'ban' ? 'Заблокировать' : 'Скрыть'}
        presets={PRESETS}
        danger={dialog === 'ban'}
        pending={pending}
        error={error}
        onConfirm={(reason) => dialog && decide(dialog, reason)}
      />
    </article>
  )
}
