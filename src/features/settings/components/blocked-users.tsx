'use client'

import { useState, useTransition } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { unblockUser } from '../actions'
import type { BlockedUser } from '../queries'

// Settings → Blocked users: everyone the viewer blocked, each with "Unblock" (after a confirm).
export function BlockedUsers({ initial }: { initial: BlockedUser[] }) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [users, setUsers] = useState(initial)
  const [confirm, setConfirm] = useState<BlockedUser | null>(null)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const unblock = (user: BlockedUser) =>
    startTransition(async () => {
      const result = await unblockUser(user.id)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setUsers((list) => list.filter((u) => u.id !== user.id))
      setConfirm(null)
    })

  if (users.length === 0) {
    return <p className="text-muted p-4 text-sm">{dict.settings.blockedEmpty}</p>
  }

  return (
    <>
      <ul className="divide-border flex flex-col divide-y">
        {users.map((user) => (
          <li key={user.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar photo={user.photo} alt={user.name} size={40} />
            <span className="min-w-0 flex-1 truncate font-medium">{user.name}</span>
            <Button variant="secondary" size="sm" onClick={() => setConfirm(user)}>
              {dict.settings.unblock}
            </Button>
          </li>
        ))}
      </ul>
      <Modal
        open={confirm !== null}
        onClose={() => !pending && setConfirm(null)}
        title={dict.settings.unblock}
      >
        <div className="flex flex-col gap-4">
          <p>{confirm && fmt(dict.settings.unblockConfirm, { name: confirm.name })}</p>
          <FormError message={errorText(error)} />
          <div className="flex flex-col gap-2">
            <Button fullWidth loading={pending} onClick={() => confirm && unblock(confirm)}>
              {dict.settings.unblock}
            </Button>
            <Button variant="ghost" fullWidth disabled={pending} onClick={() => setConfirm(null)}>
              {dict.common.cancel}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
