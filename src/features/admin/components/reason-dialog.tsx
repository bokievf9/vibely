'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { FormError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  confirmLabel: string
  presets: string[]
  danger?: boolean
  pending: boolean
  error?: string
  onConfirm: (reason: string) => void
}

// Asks the moderator for a reason (the user sees it for rejections and bans).
export function ReasonDialog({
  open,
  onClose,
  title,
  confirmLabel,
  presets,
  danger,
  pending,
  error,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('')
  const valid = reason.trim().length >= 3

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Chip key={p} selected={reason === p} onClick={() => setReason(p)}>
              {p}
            </Chip>
          ))}
        </div>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Причина (видна пользователю)"
          aria-label="Причина"
        />
        <FormError message={error} />
        <Button
          variant={danger ? 'danger' : 'primary'}
          disabled={!valid}
          loading={pending}
          onClick={() => onConfirm(reason.trim())}
          fullWidth
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
