'use client'

import { useState, useTransition } from 'react'
import { Ban, EllipsisVertical, Flag, HeartOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useI18n, useLocaleRouter } from '@/i18n/client'
import { block } from '../actions'
import { ReportDialog } from './report-dialog'

type Props = { userId: string; name: string; onUnmatch?: () => Promise<unknown> }

// "⋮" menu on a matched profile or chat: report, block, unmatch.
export function SafetyMenu({ userId, name, onUnmatch }: Props) {
  const { dict } = useI18n()
  const router = useLocaleRouter()
  const [open, setOpen] = useState<'menu' | 'report' | 'block' | 'unmatch' | null>(null)
  const [pending, startTransition] = useTransition()

  const confirmBlock = () =>
    startTransition(async () => {
      const result = await block({ userId })
      if (result.ok) router.replace('/chats')
    })

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="…" onClick={() => setOpen('menu')}>
        <EllipsisVertical className="size-6" />
      </Button>
      <Modal open={open === 'menu'} onClose={() => setOpen(null)} title={name}>
        <div className="flex flex-col gap-2">
          {onUnmatch && (
            <Button variant="secondary" fullWidth onClick={() => setOpen('unmatch')}>
              <HeartOff className="size-5" /> {dict.chats.unmatch}
            </Button>
          )}
          <Button variant="secondary" fullWidth onClick={() => setOpen('report')}>
            <Flag className="size-5" /> {dict.safety.report}
          </Button>
          <Button variant="danger" fullWidth onClick={() => setOpen('block')}>
            <Ban className="size-5" /> {dict.safety.block}
          </Button>
        </div>
      </Modal>
      <ReportDialog
        open={open === 'report'}
        onClose={() => setOpen(null)}
        targetType="user"
        targetId={userId}
      />
      <Modal
        open={open === 'block' || open === 'unmatch'}
        onClose={() => setOpen(null)}
        title={open === 'block' ? dict.safety.block : dict.chats.unmatch}
      >
        <div className="flex flex-col gap-4">
          <p>
            {fmt(open === 'block' ? dict.safety.blockConfirm : dict.chats.unmatchConfirm, { name })}
          </p>
          <Button
            variant="danger"
            fullWidth
            loading={pending}
            onClick={
              open === 'block'
                ? confirmBlock
                : () =>
                    startTransition(async () => {
                      await onUnmatch?.()
                      router.replace('/chats')
                    })
            }
          >
            {open === 'block' ? dict.safety.block : dict.chats.unmatch}
          </Button>
        </div>
      </Modal>
    </>
  )
}
