'use client'

import { useState } from 'react'
import { Ban, RotateCcw, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import type { Enums } from '@/types/database.types'
import { revokeVerification, setBan } from '../actions'
import { ReasonDialog } from './reason-dialog'
import { useModeration } from './use-moderation'

type Props = { userId: string; banned: boolean; verificationStatus: Enums<'verification_status'> }

const BAN_PRESETS = [
  'Оскорбления',
  'Спам или реклама',
  'Мошенничество',
  'Фейковый профиль',
  'Младше 18 лет',
]
const REVOKE_PRESETS = [
  'Фото не совпадают с человеком',
  'Сменил фото на чужие',
  'Подозрение на фейк',
]

export function UserActions({ userId, banned, verificationStatus }: Props) {
  const { pending, error, run } = useModeration()
  const [dialog, setDialog] = useState<'ban' | 'revoke' | null>(null)

  const confirm = async (reason: string) => {
    const ok = await run(() =>
      dialog === 'ban'
        ? setBan({ userId, banned: true, reason })
        : revokeVerification({ userId, reason }),
    )
    if (ok) setDialog(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {banned ? (
          <Button
            variant="secondary"
            loading={pending}
            onClick={() => run(() => setBan({ userId, banned: false }))}
          >
            <RotateCcw className="size-5" /> Разблокировать
          </Button>
        ) : (
          <Button variant="danger" onClick={() => setDialog('ban')} disabled={pending}>
            <Ban className="size-5" /> Заблокировать
          </Button>
        )}
        {verificationStatus === 'approved' && (
          <Button variant="secondary" onClick={() => setDialog('revoke')} disabled={pending}>
            <ShieldOff className="size-5" /> Снять верификацию
          </Button>
        )}
      </div>
      <FormError message={dialog ? undefined : error} />
      <ReasonDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'ban' ? 'Заблокировать пользователя' : 'Снять верификацию'}
        confirmLabel={dialog === 'ban' ? 'Заблокировать' : 'Снять'}
        presets={dialog === 'ban' ? BAN_PRESETS : REVOKE_PRESETS}
        danger={dialog === 'ban'}
        pending={pending}
        error={error}
        onConfirm={confirm}
      />
    </div>
  )
}
