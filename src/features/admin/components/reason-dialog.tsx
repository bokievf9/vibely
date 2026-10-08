'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { FormError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatReason } from '@/features/safety/reason-codes'

export type ReasonPreset = { value: string; label: string }

export const textPresets = (labels: string[]): ReasonPreset[] =>
  labels.map((label) => ({ value: label, label }))

type FormProps = {
  confirmLabel: string
  presets: ReasonPreset[]
  // Coded reasons (rejections, bans) are shown to users translated: a preset is required and the
  // text is an optional note appended as "code: note". Otherwise the text is the reason itself.
  coded?: boolean
  danger?: boolean
  pending: boolean
  error?: string
  onConfirm: (reason: string) => void
}

type Props = FormProps & { open: boolean; onClose: () => void; title: string }

export function ReasonDialog({ open, onClose, title, ...form }: Props) {
  // The form mounts with the modal, so every opening starts empty.
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <ReasonForm {...form} />
    </Modal>
  )
}

function ReasonForm({
  confirmLabel,
  presets,
  coded,
  danger,
  pending,
  error,
  onConfirm,
}: FormProps) {
  const [preset, setPreset] = useState<string>()
  const [text, setText] = useState('')
  const valid = coded ? preset !== undefined : text.trim().length >= 3

  const pick = (value: string) => {
    setPreset(value)
    if (!coded) setText(value)
  }
  const confirm = () => {
    if (coded && preset) onConfirm(formatReason(preset, text))
    else if (!coded) onConfirm(text.trim())
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Chip
            key={p.value}
            selected={coded ? preset === p.value : text === p.value}
            onClick={() => pick(p.value)}
          >
            {p.label}
          </Chip>
        ))}
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={coded ? 300 : 500}
        placeholder={
          coded
            ? 'Пояснение (необязательно). Пользователь увидит его как есть — пишите по-английски'
            : 'Причина (видна только модераторам)'
        }
        aria-label={coded ? 'Пояснение' : 'Причина'}
      />
      <FormError message={error} />
      <Button
        variant={danger ? 'danger' : 'primary'}
        disabled={!valid}
        loading={pending}
        onClick={confirm}
        fullWidth
      >
        {confirmLabel}
      </Button>
    </div>
  )
}
