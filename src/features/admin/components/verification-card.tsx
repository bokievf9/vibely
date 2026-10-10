'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { rejectUnderage, reviewVerification } from '../actions'
import type { PendingVerification } from '../queries/verification'
import { formatDate } from './badges'
import { PhotoStrip } from './photo-strip'
import { REJECTION_CODES } from '@/features/safety/reason-codes'
import { REJECTION_LABELS, UNDERAGE_REJECTION_LABEL, presetsOf } from '../labels'
import { MODERATOR_MAX_BAN_DAYS, hasRole, type AdminRole } from '../roles'
import { ReasonDialog } from './reason-dialog'
import { useModeration } from './use-moderation'

const REJECT_PRESETS = presetsOf(REJECTION_CODES, REJECTION_LABELS)

export function VerificationCard({
  request,
  role,
}: {
  request: PendingVerification
  role: AdminRole
}) {
  const { pending, error, run } = useModeration()
  const [rejecting, setRejecting] = useState(false)
  const [underage, setUnderage] = useState(false)
  const dialogOpen = rejecting || underage

  return (
    <article className="bg-surface flex flex-col gap-4 rounded-3xl p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href={`/admin/users/${request.userId}`}
          className="text-lg font-semibold underline-offset-4 hover:underline"
        >
          {request.displayName}, {request.age}
        </Link>
        <time className="text-muted text-sm" dateTime={request.createdAt}>
          {formatDate(request.createdAt)}
        </time>
      </header>
      <p className="bg-accent/15 text-accent rounded-2xl px-3 py-2 text-sm font-medium">
        Задание: {request.challenge}
      </p>
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        {request.selfieUrl ? (
          <a href={request.selfieUrl} target="_blank" rel="noreferrer">
            <Image
              src={request.selfieUrl}
              alt="Селфи"
              width={200}
              height={267}
              sizes="200px"
              className="aspect-[3/4] w-full rounded-2xl object-cover sm:w-[200px]"
            />
          </a>
        ) : (
          <p className="text-red-400">Селфи не найдено</p>
        )}
        <PhotoStrip photos={request.photos} label="Фото профиля" />
      </div>
      <FormError message={dialogOpen ? undefined : error} />
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => setRejecting(true)} disabled={pending}>
          <X className="size-5" /> Отклонить
        </Button>
        <Button
          onClick={() => run(() => reviewVerification({ requestId: request.id, approve: true }))}
          loading={pending && !dialogOpen}
        >
          <Check className="size-5" /> Одобрить
        </Button>
        <Button
          variant="danger"
          className="col-span-2"
          onClick={() => setUnderage(true)}
          disabled={pending}
        >
          <ShieldAlert className="size-5" /> {UNDERAGE_REJECTION_LABEL}
        </Button>
      </div>
      <Modal open={underage} onClose={() => setUnderage(false)} title={UNDERAGE_REJECTION_LABEL}>
        <div className="flex flex-col gap-4">
          <p className="text-sm">Одним действием:</p>
          <ul className="text-muted flex list-disc flex-col gap-1 pl-5 text-sm">
            <li>селфи отклоняется с причиной «{UNDERAGE_REJECTION_LABEL}»;</li>
            <li>
              аккаунт блокируется с причиной «Младше 18 лет»{' '}
              {hasRole(role, 'admin')
                ? 'бессрочно'
                : `на ${MODERATOR_MAX_BAN_DAYS} дней (продлить до бессрочного может админ на странице пользователя)`}
              ;
            </li>
            <li>профиль скрывается из поиска, звонки и блайнд-дейты завершаются;</li>
            <li>решение записывается в журнал.</li>
          </ul>
          <p className="text-muted text-sm">
            Пользователь увидит, что Vibely только для 18+, и сможет подать апелляцию.
          </p>
          <FormError message={underage ? error : undefined} />
          <Button
            variant="danger"
            fullWidth
            loading={pending}
            onClick={async () => {
              if (await run(() => rejectUnderage({ requestId: request.id }))) setUnderage(false)
            }}
          >
            Отклонить и заблокировать
          </Button>
        </div>
      </Modal>
      <ReasonDialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Отклонить селфи"
        confirmLabel="Отклонить"
        presets={REJECT_PRESETS}
        coded
        danger
        pending={pending}
        error={error}
        onConfirm={async (reason) => {
          if (
            await run(() => reviewVerification({ requestId: request.id, approve: false, reason }))
          )
            setRejecting(false)
        }}
      />
    </article>
  )
}
