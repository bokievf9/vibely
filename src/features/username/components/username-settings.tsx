'use client'

import { useState, useTransition } from 'react'
import { AtSign, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { formatDay } from '@/i18n/format'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { SwitchRow } from '@/features/settings/components/switch-row'
import { changeUsername, setSearchable } from '../actions'
import { isValidUsername, normalizeUsername, type UsernameSettings } from '../schemas'
import { UsernameField } from './username-field'

// Settings → Username: the current @handle, "Change" (30-day cooldown) and "Find me by username".
export function UsernameSettingsRows({ initial }: { initial: UsernameSettings }) {
  const { dict, locale } = useI18n()
  const t = dict.username
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [username, setUsername] = useState(initial.username)
  const [nextChangeAt, setNextChangeAt] = useState(initial.nextChangeAt)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initial.username)
  const [error, setError] = useState<ErrorKey>()
  const [saving, startSaving] = useTransition()
  // my_username() only returns a date while the 30-day cooldown is running.
  const locked = nextChangeAt !== null

  const close = () => {
    setOpen(false)
    setError(undefined)
  }
  const save = () =>
    startSaving(async () => {
      const result = await changeUsername(draft)
      if (!result.ok) return setError(result.error)
      if (result.data !== username) {
        setUsername(result.data)
        setNextChangeAt(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
      }
      close()
      router.refresh()
    })
  const unchanged = normalizeUsername(draft) === username

  return (
    <>
      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <AtSign className="size-5 shrink-0" aria-hidden />
            <span className="truncate">{username}</span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={locked}
            onClick={() => {
              setDraft(username)
              setOpen(true)
            }}
          >
            {t.change}
          </Button>
        </div>
        <p className="text-muted text-sm">
          {nextChangeAt
            ? fmt(t.nextChange, { date: formatDay(nextChangeAt, locale) })
            : t.onceIn30Days}
        </p>
      </div>
      <SwitchRow
        icon={Search}
        label={t.findMe}
        hint={t.findMeHint}
        initial={initial.searchable}
        save={setSearchable}
      />
      <Modal open={open} onClose={close} title={t.changeTitle}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!unchanged && isValidUsername(draft)) save()
          }}
        >
          <UsernameField
            id="settings-username"
            value={draft}
            onChange={(v) => {
              setDraft(v)
              setError(undefined)
            }}
            error={errorText(error)}
            autoFocus
          />
          <p className="text-muted text-sm">{t.onceIn30Days}</p>
          <Button
            type="submit"
            loading={saving}
            disabled={unchanged || !isValidUsername(draft)}
            fullWidth
          >
            {t.save}
          </Button>
        </form>
      </Modal>
    </>
  )
}
