'use client'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useI18n } from '@/i18n/client'

type Props = { open: boolean; pending: boolean; onCancel: () => void; onConfirm: () => void }

export function DeleteDialog({ open, pending, onCancel, onConfirm }: Props) {
  const { dict } = useI18n()
  return (
    <Modal open={open} onClose={onCancel} title={dict.chats.deleteTitle}>
      <p className="text-muted mb-5">{dict.chats.deleteText}</p>
      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onCancel}>
          {dict.common.cancel}
        </Button>
        <Button variant="danger" fullWidth loading={pending} onClick={onConfirm}>
          {dict.chats.delete}
        </Button>
      </div>
    </Modal>
  )
}
