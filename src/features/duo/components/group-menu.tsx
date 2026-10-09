'use client'

import { useState, useTransition } from 'react'
import { Ban, EllipsisVertical, Flag, LogOut } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { block } from '@/features/safety/actions'
import { ReportDialog } from '@/features/safety/components/report-dialog'
import { leaveGroup } from '../actions'
import type { GroupMember } from '../types'

type Open = 'menu' | 'pickReport' | 'pickBlock' | 'leave' | null

// "⋮" in a duo chat: report a member (group_member report), block a member (the blocker leaves
// the group, no future duo matches with that person's duo) or leave the group.
export function GroupMenu({
  groupId,
  viewerId,
  members,
}: {
  groupId: string
  viewerId: string
  members: GroupMember[]
}) {
  const { dict } = useI18n()
  const t = dict.duo
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [open, setOpen] = useState<Open>(null)
  const [reportMember, setReportMember] = useState<GroupMember | null>(null)
  const [blockMember, setBlockMember] = useState<GroupMember | null>(null)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const others = members.filter((m) => m.id !== viewerId)

  const leave = () =>
    startTransition(async () => {
      const result = await leaveGroup(groupId)
      if (!result.ok) return setError(result.error)
      router.replace('/chats')
      router.refresh()
    })

  const confirmBlock = () =>
    startTransition(async () => {
      if (!blockMember) return
      const result = await block({ userId: blockMember.id })
      if (!result.ok) return setError(result.error)
      router.replace('/chats')
      router.refresh()
    })

  const picker = (onPick: (m: GroupMember) => void) => (
    <ul className="flex flex-col gap-2">
      {others.map((m) => (
        <li key={m.id}>
          <Button
            variant="secondary"
            fullWidth
            className="justify-start"
            onClick={() => {
              setOpen(null)
              onPick(m)
            }}
          >
            <Avatar photo={m.photo} alt="" size={32} />
            <span className="truncate">
              {m.name}
              {m.left && <span className="text-muted font-normal"> ({t.memberLeft})</span>}
            </span>
          </Button>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={dict.common.moreOptions}
        onClick={() => setOpen('menu')}
      >
        <EllipsisVertical className="size-6" />
      </Button>
      <Modal open={open === 'menu'} onClose={() => setOpen(null)} title={t.groupTitle}>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" fullWidth onClick={() => setOpen('pickReport')}>
            <Flag className="size-5" aria-hidden /> {t.reportMember}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setOpen('pickBlock')}>
            <Ban className="size-5" aria-hidden /> {t.blockMember}
          </Button>
          <Button variant="danger" fullWidth onClick={() => setOpen('leave')}>
            <LogOut className="size-5" aria-hidden /> {t.leaveGroup}
          </Button>
        </div>
      </Modal>
      <Modal open={open === 'pickReport'} onClose={() => setOpen(null)} title={t.pickMember}>
        {picker((m) => setReportMember(m))}
      </Modal>
      <Modal open={open === 'pickBlock'} onClose={() => setOpen(null)} title={t.pickMember}>
        {picker((m) => setBlockMember(m))}
      </Modal>
      <ReportDialog
        key={reportMember?.memberId ?? 'none'}
        open={!!reportMember?.memberId}
        onClose={() => setReportMember(null)}
        targetType="group_member"
        targetId={reportMember?.memberId ?? ''}
        note={dict.reports.reviewNote}
      />
      <Modal open={!!blockMember} onClose={() => setBlockMember(null)} title={dict.safety.block}>
        <div className="flex flex-col gap-4">
          <p className="text-muted">
            {fmt(t.blockMemberConfirm, { name: blockMember?.name ?? '' })}
          </p>
          <FormError message={errorText(error)} />
          <Button variant="danger" fullWidth loading={pending} onClick={confirmBlock}>
            {dict.safety.block}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setBlockMember(null)}>
            {dict.common.cancel}
          </Button>
        </div>
      </Modal>
      <Modal open={open === 'leave'} onClose={() => setOpen(null)} title={t.leaveGroup}>
        <div className="flex flex-col gap-4">
          <p className="text-muted">{t.leaveGroupConfirm}</p>
          <FormError message={errorText(error)} />
          <Button variant="danger" fullWidth loading={pending} onClick={leave}>
            {t.leaveGroup}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setOpen(null)}>
            {dict.common.cancel}
          </Button>
        </div>
      </Modal>
    </>
  )
}
