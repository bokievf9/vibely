'use client'

import { useState } from 'react'
import {
  Archive,
  Ban,
  EyeOff,
  MicOff,
  RotateCcw,
  ShieldOff,
  TriangleAlert,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { FormError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { BAN_CODES, formatReason } from '@/features/safety/reason-codes'
import type { Enums } from '@/types/database.types'
import type { ActionResult } from '@/types/action-result'
import { revokeVerification } from '../actions'
import { BAN_LABELS, presetsOf } from '../labels'
import { hasRole, MODERATOR_MAX_BAN_DAYS, type AdminRole } from '../roles'
import {
  banUser,
  setEvidenceHold,
  setMute,
  setShadowBan,
  unbanUser,
  warnUser,
} from '../sanction-actions'
import { textPresets, type ReasonPreset } from './reason-dialog'
import { useAdminAction } from './use-admin-action'

type Props = {
  userId: string
  role: AdminRole
  banned: boolean
  verificationStatus: Enums<'verification_status'>
  muted: boolean
  shadowBanned: boolean
  evidenceHold: boolean
}

type Kind = 'warn' | 'mute' | 'ban' | 'revoke' | 'shadow' | 'hold'
type Option = { value: number | null; label: string; min: AdminRole }
type Spec = {
  title: string
  confirm: string
  // Coded reasons are shown to the user translated ("code: note"); others stay internal.
  coded: boolean
  presets: ReasonPreset[]
  options?: Option[]
  defaultOption?: number | null
  danger?: boolean
  internalNote?: boolean
  blockPhone?: boolean
  placeholder?: string
}

const BAN_PRESETS = presetsOf(BAN_CODES, BAN_LABELS)
const day = (n: number, label: string, min: AdminRole = 'moderator'): Option => ({
  value: n,
  label,
  min,
})

const SPECS: Record<Kind, Spec> = {
  warn: {
    title: 'Предупреждение',
    confirm: 'Вынести предупреждение',
    coded: true,
    presets: BAN_PRESETS,
    options: [day(7, '7 дней'), day(30, '30 дней'), day(90, '90 дней')],
    defaultOption: 30,
    internalNote: true,
  },
  mute: {
    title: 'Мут: запрет писать',
    confirm: 'Выдать мут',
    coded: true,
    presets: BAN_PRESETS,
    options: [
      day(1, '1 час'),
      day(6, '6 часов'),
      day(24, '1 день'),
      day(72, '3 дня'),
      day(168, '7 дней'),
      day(720, '30 дней'),
    ],
    defaultOption: 24,
  },
  ban: {
    title: 'Заблокировать пользователя',
    confirm: 'Заблокировать',
    coded: true,
    presets: BAN_PRESETS,
    options: [
      day(1, '1 день'),
      day(3, '3 дня'),
      day(MODERATOR_MAX_BAN_DAYS, '7 дней'),
      day(30, '30 дней', 'admin'),
      day(90, '90 дней', 'admin'),
      { value: null, label: 'Навсегда', min: 'admin' },
    ],
    defaultOption: 3,
    danger: true,
    blockPhone: true,
  },
  revoke: {
    title: 'Снять верификацию',
    confirm: 'Снять',
    coded: false,
    presets: textPresets([
      'Фото не совпадают с человеком',
      'Сменил фото на чужие',
      'Подозрение на фейк',
    ]),
  },
  shadow: {
    title: 'Теневой бан',
    confirm: 'Включить',
    coded: false,
    presets: textPresets(['Спам в ленте', 'Массовые лайки', 'Подозрение на бота']),
    placeholder: 'Причина (видна только модераторам)',
  },
  hold: {
    title: 'Удержание данных',
    confirm: 'Включить удержание',
    coded: false,
    presets: [],
    placeholder: 'Номер дела или юридического запроса',
  },
}

export function UserActions(props: Props) {
  const { userId, role, banned, verificationStatus, muted, shadowBanned, evidenceHold } = props
  const { pending, error, run } = useAdminAction()
  const [dialog, setDialog] = useState<Kind | null>(null)
  const can = (min: AdminRole) => hasRole(role, min)

  const quick = (action: () => Promise<ActionResult<unknown>>) => run(action)

  const confirm = async (v: Values) => {
    const reason = v.reason
    let result: ActionResult<unknown>
    switch (dialog) {
      case 'warn':
        result = await run(() =>
          warnUser({ userId, reason, note: v.internalNote, days: v.option ?? 30 }),
        )
        break
      case 'mute':
        result = await run(() => setMute({ userId, mute: true, hours: v.option ?? 24, reason }))
        break
      case 'ban':
        result = await run(() =>
          banUser({ userId, reason, days: v.option, blockPhone: v.blockPhone }),
        )
        break
      case 'revoke':
        result = await run(() => revokeVerification({ userId, reason }))
        break
      case 'shadow':
        result = await run(() => setShadowBan({ userId, on: true, reason }))
        break
      case 'hold':
        result = await run(() => setEvidenceHold({ userId, on: true, reason }))
        break
      default:
        return
    }
    if (result.ok) setDialog(null)
  }

  if (!can('moderator')) {
    return <p className="text-muted text-sm">Роль «Наблюдатель»: только просмотр.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setDialog('warn')} disabled={pending}>
          <TriangleAlert className="size-4" /> Предупредить
        </Button>
        {muted ? (
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() => quick(() => setMute({ userId, mute: false }))}
          >
            <Volume2 className="size-4" /> Снять мут
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDialog('mute')}
            disabled={pending}
          >
            <MicOff className="size-4" /> Мут
          </Button>
        )}
        {banned ? (
          can('admin') && (
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={() => quick(() => unbanUser({ userId }))}
            >
              <RotateCcw className="size-4" /> Разблокировать
            </Button>
          )
        ) : (
          <Button variant="danger" size="sm" onClick={() => setDialog('ban')} disabled={pending}>
            <Ban className="size-4" /> Заблокировать
          </Button>
        )}
        {can('admin') && verificationStatus === 'approved' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDialog('revoke')}
            disabled={pending}
          >
            <ShieldOff className="size-4" /> Снять верификацию
          </Button>
        )}
        {can('admin') &&
          (shadowBanned ? (
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={() => quick(() => setShadowBan({ userId, on: false }))}
            >
              <EyeOff className="size-4" /> Выключить теневой бан
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDialog('shadow')}
              disabled={pending}
            >
              <EyeOff className="size-4" /> Теневой бан
            </Button>
          ))}
        {can('admin') &&
          (evidenceHold ? (
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={() => quick(() => setEvidenceHold({ userId, on: false }))}
            >
              <Archive className="size-4" /> Снять удержание
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDialog('hold')}
              disabled={pending}
            >
              <Archive className="size-4" /> Удержать данные
            </Button>
          ))}
      </div>
      <FormError message={dialog ? undefined : error} />
      {dialog && (
        <Modal open onClose={() => setDialog(null)} title={SPECS[dialog].title}>
          <SanctionForm
            spec={SPECS[dialog]}
            role={role}
            pending={pending}
            error={error}
            onConfirm={confirm}
          />
        </Modal>
      )}
    </div>
  )
}

type Values = { reason: string; internalNote?: string; option: number | null; blockPhone: boolean }

function SanctionForm({
  spec,
  role,
  pending,
  error,
  onConfirm,
}: {
  spec: Spec
  role: AdminRole
  pending: boolean
  error?: string
  onConfirm: (v: Values) => void
}) {
  const [preset, setPreset] = useState<string>()
  const [text, setText] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [option, setOption] = useState<number | null>(spec.defaultOption ?? null)
  const [blockPhone, setBlockPhone] = useState(false)
  const admin = hasRole(role, 'admin')
  const valid = spec.coded ? preset !== undefined : text.trim().length >= 3

  const submit = () => {
    const reason = spec.coded && preset ? formatReason(preset, text) : text.trim()
    onConfirm({
      reason,
      internalNote: internalNote.trim() || undefined,
      option,
      blockPhone: blockPhone && admin,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {spec.options && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Срок">
          {spec.options
            .filter((o) => hasRole(role, o.min))
            .map((o) => (
              <Chip
                key={String(o.value)}
                selected={option === o.value}
                onClick={() => setOption(o.value)}
              >
                {o.label}
              </Chip>
            ))}
        </div>
      )}
      {spec.presets.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Причина">
          {spec.presets.map((p) => (
            <Chip
              key={p.value}
              selected={spec.coded ? preset === p.value : text === p.value}
              onClick={() => (spec.coded ? setPreset(p.value) : setText(p.value))}
            >
              {p.label}
            </Chip>
          ))}
        </div>
      )}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={spec.coded ? 300 : 500}
        placeholder={
          spec.placeholder ??
          (spec.coded
            ? 'Пояснение (необязательно). Пользователь увидит его как есть, пишите по-английски'
            : 'Причина (видна только модераторам)')
        }
        aria-label="Пояснение"
      />
      {spec.internalNote && (
        <Textarea
          value={internalNote}
          onChange={(e) => setInternalNote(e.target.value)}
          maxLength={500}
          placeholder="Внутренняя заметка (пользователь её не увидит)"
          aria-label="Внутренняя заметка"
        />
      )}
      {spec.blockPhone && admin && (
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={blockPhone}
            onChange={(e) => setBlockPhone(e.target.checked)}
            className="accent-accent size-5"
          />
          Заблокировать и номер телефона (новый аккаунт на этот номер создать нельзя)
        </label>
      )}
      <FormError message={error} />
      <Button
        variant={spec.danger ? 'danger' : 'primary'}
        disabled={!valid}
        loading={pending}
        onClick={submit}
        fullWidth
      >
        {spec.confirm}
      </Button>
    </div>
  )
}
