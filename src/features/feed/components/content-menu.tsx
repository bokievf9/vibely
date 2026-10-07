'use client'

import { useState, useTransition } from 'react'
import { EllipsisVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useI18n } from '@/i18n/client'
import { ReportDialog } from '@/features/safety/components/report-dialog'
import type { UserResult } from '@/i18n/errors'

type Props = {
  type: 'post' | 'comment'
  id: string
  isMine: boolean
  onDelete: () => Promise<UserResult>
  onDeleted: () => void
}

// Own content: delete. Someone else's: report (moderators see the real author).
export function ContentMenu({ type, id, isMine, onDelete, onDeleted }: Props) {
  const { dict } = useI18n()
  const [open, setOpen] = useState<'confirm' | 'report' | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <>
      <button
        type="button"
        aria-label={isMine ? dict.feed.delete : dict.safety.report}
        className="text-muted -m-2 p-2"
        onClick={() => setOpen(isMine ? 'confirm' : 'report')}
      >
        {isMine ? <Trash2 className="size-4" /> : <EllipsisVertical className="size-4" />}
      </button>
      <Modal open={open === 'confirm'} onClose={() => setOpen(null)} title={dict.feed.delete}>
        <div className="flex flex-col gap-4">
          <p>{dict.feed.deleteConfirm}</p>
          <Button
            variant="danger"
            fullWidth
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                if ((await onDelete()).ok) {
                  setOpen(null)
                  onDeleted()
                }
              })
            }
          >
            {dict.feed.delete}
          </Button>
        </div>
      </Modal>
      {open === 'report' && (
        <ReportDialog open onClose={() => setOpen(null)} targetType={type} targetId={id} />
      )}
    </>
  )
}
