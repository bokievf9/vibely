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

// TODO(ui/shell): replace with the danger token once the shell branch adds it.
const DANGER = 'bg-danger-strong'

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
      className="border-danger/30 flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 id="danger-zone" className="text-danger text-sm font-medium">
        {dict.account.dangerZone}
      </h2>
      {/* Outlined here; the filled red button is kept for the final, irreversible step. */}
      <Button
        variant="ghost"
        className="border-danger/40 text-danger active:bg-danger/10 border"
        onClick={() => setOpen(true)}
        fullWidth
      >
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
          {/* Stacked, not side by side: "Padam selama-lamanya" / "Удалить навсегда" do not fit
              half of a 320px sheet. */}
          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              variant="danger"
              className={DANGER}
              fullWidth
              disabled={!valid}
              loading={pending}
            >
              {dict.account.deleteConfirm}
            </Button>
            <Button variant="ghost" fullWidth onClick={close} disabled={pending}>
              {dict.common.cancel}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
