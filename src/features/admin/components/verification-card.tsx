'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { reviewVerification } from '../actions'
import type { PendingVerification } from '../queries/verification'
import { formatDate } from './badges'
import { PhotoStrip } from './photo-strip'
import { REJECTION_CODES } from '@/features/safety/reason-codes'
import { REJECTION_LABELS, presetsOf } from '../labels'
import { ReasonDialog } from './reason-dialog'
import { useModeration } from './use-moderation'

const REJECT_PRESETS = presetsOf(REJECTION_CODES, REJECTION_LABELS)

export function VerificationCard({ request }: { request: PendingVerification }) {
  const { pending, error, run } = useModeration()
  const [rejecting, setRejecting] = useState(false)

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
      <FormError message={rejecting ? undefined : error} />
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => setRejecting(true)} disabled={pending}>
          <X className="size-5" /> Отклонить
        </Button>
        <Button
          onClick={() => run(() => reviewVerification({ requestId: request.id, approve: true }))}
          loading={pending && !rejecting}
        >
          <Check className="size-5" /> Одобрить
        </Button>
      </div>
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
