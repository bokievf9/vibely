'use client'

import { useState } from 'react'
import { Ban, EyeOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { resolveReports } from '../actions'
import type { ReportGroup } from '../queries/reports'
import { BAN_CODES } from '@/features/safety/reason-codes'
import { BAN_LABELS, TARGET_LABELS, presetsOf, readableReportReason } from '../labels'
import { formatDate } from './badges'
import { ReasonDialog, textPresets } from './reason-dialog'
import { ReportContextView } from './report-context-view'
import { useModeration } from './use-moderation'

// Hiding is anonymous (the author isn't told why), so its reason is free text.
const HIDE_PRESETS = textPresets([
  'Оскорбления',
  'Спам или реклама',
  'Сексуальный контент',
  'Мошенничество',
  'Угрозы',
])
const BAN_PRESETS = presetsOf(BAN_CODES, BAN_LABELS)

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
            {readableReportReason(r.reason)}
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
        presets={dialog === 'ban' ? BAN_PRESETS : HIDE_PRESETS}
        coded={dialog === 'ban'}
        danger={dialog === 'ban'}
        pending={pending}
        error={error}
        onConfirm={(reason) => dialog && decide(dialog, reason)}
      />
    </article>
  )
}
