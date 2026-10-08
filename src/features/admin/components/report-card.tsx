'use client'

import { useState } from 'react'
import { Ban, EyeOff, Hand, Trash2, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { BAN_CODES } from '@/features/safety/reason-codes'
import { BAN_LABELS, TARGET_LABELS, presetsOf, readableReportReason } from '../labels'
import { claimCase, releaseCase, resolveCase } from '../report-actions'
import { STATUS_LABELS, slaOf, tierLabel } from '../report-labels'
import type { ReportCase } from '../queries/reports'
import { hasRole, type AdminRole } from '../roles'
import { Badge, formatDate } from './badges'
import { EvidencePanel } from './evidence-panel'
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
const PHOTO_PRESETS = textPresets([
  'Нет лица или не человек',
  'Чужое фото или знаменитость',
  'Обнажённость или 18+',
  'Контакты или реклама на фото',
  'Оскорбительное содержание',
])
const BAN_PRESETS = presetsOf(BAN_CODES, BAN_LABELS)
const PERSONAL = new Set(['user', 'message', 'photo', 'call'])

type Dialog = 'hide' | 'ban' | 'delete_photo' | null

export function ReportCard({
  group,
  role,
  selected = false,
  onSelect,
}: {
  group: ReportCase
  // Viewers only read; moderators ban for 7 days, admins and owners permanently (the RPC decides).
  role: AdminRole
  selected?: boolean
  onSelect?: (selected: boolean) => void
}) {
  const { pending, error, run } = useModeration()
  const [dialog, setDialog] = useState<Dialog>(null)
  const { targetType, targetId, context } = group
  const target = { targetType, targetId }
  const canHide =
    (targetType === 'post' || targetType === 'comment') &&
    context &&
    'hidden' in context &&
    !context.hidden
  const canDeletePhoto = targetType === 'photo' && context?.kind === 'photo'
  const offender = context?.offender ?? null
  const canAct = hasRole(role, 'moderator')
  const banForever = hasRole(role, 'admin')
  const heldByOther = group.status === 'in_review' && group.claimedBy && !group.claimedBy.me
  const tier = tierLabel(group.tier)
  const sla = slaOf(group.ageMinutes)

  // One entry per reporter (a reporter has at most one open report per target).
  const reporters = [...new Map(group.reasons.map((r) => [r.reporterId, r.reporterName]))].map(
    ([id, name]) => ({ id, name }),
  )

  const decide = async (decision: Exclude<Dialog, null>, reason: string) => {
    const ok = await run(() => {
      if (decision === 'ban' && offender)
        return resolveCase({ ...target, decision, offenderId: offender.id, reason })
      if (decision === 'delete_photo')
        return resolveCase({ targetType: 'photo', targetId, decision, reason })
      return resolveCase({
        targetType: targetType as 'post' | 'comment',
        targetId,
        decision: 'hide',
        reason,
      })
    })
    if (ok) setDialog(null)
  }

  return (
    <article
      className={`bg-surface flex flex-col gap-4 rounded-3xl p-4 ${selected ? 'ring-accent ring-2' : ''}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            aria-label="Выбрать для массового действия"
            className="accent-accent size-5"
          />
        )}
        <h2 className="font-semibold">
          {TARGET_LABELS[targetType]} · {group.reasons.length} жалоб(ы)
        </h2>
        <Badge className={tier.className}>{tier.label}</Badge>
        <Badge className={sla.className}>
          <time dateTime={group.firstReportedAt} title={formatDate(group.firstReportedAt)}>
            {sla.label}
          </time>
        </Badge>
        <Badge
          className={
            group.status === 'in_review' ? 'bg-sky-500/15 text-sky-400' : 'bg-border text-muted'
          }
        >
          {group.status === 'in_review' && group.claimedBy
            ? `${STATUS_LABELS.in_review}: ${group.claimedBy.me ? 'вы' : group.claimedBy.name}`
            : STATUS_LABELS.open}
        </Badge>
        <span className="ml-auto">
          {!canAct ? null : group.claimedBy?.me ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => releaseCase(target))}
            >
              <Undo2 className="size-4" /> Вернуть в очередь
            </Button>
          ) : (
            !heldByOther && (
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => claimCase(target))}
              >
                <Hand className="size-4" /> Взять в работу
              </Button>
            )
          )}
        </span>
      </header>
      <ReportContextView context={context} />
      <ul className="flex flex-col gap-1 text-sm">
        {group.reasons.map((r) => (
          <li key={r.reporterId}>
            <span className="text-muted">
              {formatDate(r.createdAt)} · {r.reporterName}:{' '}
            </span>
            {readableReportReason(r.reason)}
          </li>
        ))}
      </ul>
      {canAct && offender && PERSONAL.has(targetType) && (
        <EvidencePanel
          targetType={targetType}
          targetId={targetId}
          offender={offender}
          reporters={reporters.filter((r) => r.id !== offender.id)}
        />
      )}
      <FormError message={dialog ? undefined : error} />
      {!canAct ? (
        <p className="text-muted text-sm">Роль «Наблюдатель»: только просмотр.</p>
      ) : heldByOther ? (
        <p className="text-muted text-sm">
          Решение принимает {group.claimedBy?.name}. Жалоба вернётся в очередь через 30 минут без
          активности.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            loading={pending && !dialog}
            onClick={() => run(() => resolveCase({ ...target, decision: 'dismiss' }))}
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
          {canDeletePhoto && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDialog('delete_photo')}
              disabled={pending}
            >
              <Trash2 className="size-4" /> Удалить фото
            </Button>
          )}
          {offender && (
            <Button size="sm" variant="danger" onClick={() => setDialog('ban')} disabled={pending}>
              <Ban className="size-4" /> {banForever ? 'Заблокировать' : 'Заблокировать на 7 дней'}
            </Button>
          )}
        </div>
      )}
      <ReasonDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog === 'ban'
            ? `Заблокировать ${offender?.name ?? ''}${banForever ? '' : ' на 7 дней'}`
            : dialog === 'delete_photo'
              ? 'Удалить фото'
              : 'Скрыть контент'
        }
        confirmLabel={
          dialog === 'ban' ? 'Заблокировать' : dialog === 'delete_photo' ? 'Удалить' : 'Скрыть'
        }
        presets={
          dialog === 'ban' ? BAN_PRESETS : dialog === 'delete_photo' ? PHOTO_PRESETS : HIDE_PRESETS
        }
        coded={dialog === 'ban'}
        danger={dialog !== 'hide'}
        pending={pending}
        error={error}
        onConfirm={(reason) => dialog && decide(dialog, reason)}
      />
    </article>
  )
}
