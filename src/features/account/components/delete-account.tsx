'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import { resetBrowserToken } from '@/lib/supabase/client'
import { deleteAccount } from '../actions'
import { DELETE_CONFIRM_WORD, deleteAccountSchema } from '../schemas'

// Danger zone on the own profile: type DELETE → the account and all its data are removed.
export function DeleteAccount() {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const valid = deleteAccountSchema.safeParse({ confirm }).success

  const close = () => {
    if (pending) return
    setOpen(false)
    setConfirm('')
    setError(undefined)
  }

  const submit = () =>
    startTransition(async () => {
      setError(undefined)
      resetBrowserToken()
      // On success the action redirects to /login and never returns.
      const result = await deleteAccount({ confirm })
      if (!result.ok) setError(result.error)
    })

  return (
    <section
      aria-labelledby="danger-zone"
      className="flex flex-col gap-3 rounded-2xl border border-red-500/30 p-4"
    >
      <h2 id="danger-zone" className="text-sm font-medium text-red-400">
        {dict.account.dangerZone}
      </h2>
      <Button variant="danger" onClick={() => setOpen(true)} fullWidth>
        <Trash2 className="size-5" /> {dict.account.delete}
      </Button>
      <Modal open={open} onClose={close} title={dict.account.deleteTitle}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) submit()
          }}
        >
          <p className="text-muted text-sm leading-relaxed">{dict.account.deleteWarning}</p>
          <Field
            label={fmt(dict.account.deleteType, { word: DELETE_CONFIRM_WORD })}
            htmlFor="delete-confirm"
          >
            <Input
              id="delete-confirm"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={DELETE_CONFIRM_WORD}
            />
          </Field>
          <FormError message={errorText(error)} />
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={close} disabled={pending}>
              {dict.common.cancel}
            </Button>
            <Button type="submit" variant="danger" disabled={!valid} loading={pending}>
              {dict.account.deleteConfirm}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
