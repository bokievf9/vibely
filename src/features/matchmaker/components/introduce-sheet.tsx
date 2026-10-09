'use client'

import { useEffect, useState, useTransition } from 'react'
import { Check, HeartHandshake, Search } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Field, FormError } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { createReferral, loadIntroducible } from '../actions'
import { filterIntroducible } from '../card'
import { NOTE_MAX, type Introducible } from '../types'

type Props = { open: boolean; onClose: () => void; partnerId: string; partnerName: string }

// "Introduce to a friend": pick one of the other matches, add a note, send. The chat partner
// gets the card first; the other person only after the partner is interested.
export function IntroduceSheet({ open, onClose, partnerId, partnerName }: Props) {
  const { dict } = useI18n()
  const t = dict.matchmaker
  const errorText = useErrorText()
  const [people, setPeople] = useState<Introducible[] | null>(null)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Introducible | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<ErrorKey>()
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let live = true
    void loadIntroducible(partnerId).then((list) => live && setPeople(list))
    return () => {
      live = false
    }
  }, [open, partnerId])

  const close = () => {
    onClose()
    setQuery('')
    setPicked(null)
    setNote('')
    setError(undefined)
    setSent(false)
  }

  const send = () =>
    startTransition(async () => {
      if (!picked) return
      const result = await createReferral({ partnerId, otherId: picked.id, note })
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setSent(true)
    })

  const list = filterIntroducible(people ?? [], query)
  return (
    <Modal
      open={open}
      onClose={close}
      title={fmt(t.sheetTitle, { name: partnerName })}
      footer={
        sent ? (
          <Button fullWidth onClick={close}>
            {t.done}
          </Button>
        ) : (
          <Button fullWidth disabled={!picked || pending} loading={pending} onClick={send}>
            {t.send}
          </Button>
        )
      }
    >
      {sent && picked ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="icon-tile text-accent size-14 rounded-2xl">
            <HeartHandshake className="size-7" aria-hidden />
          </span>
          <p className="text-headline">{t.sent}</p>
          <p className="text-muted text-sm">
            {fmt(t.sentHint, { name: partnerName, other: picked.name })}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-muted text-sm">{t.sheetHint}</p>
          <div className="relative">
            <Search
              className="text-muted pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="search"
              placeholder={t.search}
              aria-label={t.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 pl-11"
              data-sheet-no-drag
            />
          </div>
          {people === null ? (
            <ul className="flex flex-col gap-2" aria-label={t.loading}>
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 px-1 py-1.5">
                  <Skeleton className="size-11 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </li>
              ))}
            </ul>
          ) : list.length === 0 ? (
            <p className="text-muted py-2 text-center text-sm">
              {people.length === 0 ? t.noMatches : t.nothingFound}
            </p>
          ) : (
            <ul
              className="card divide-border flex max-h-64 flex-col divide-y overflow-y-auto"
              role="listbox"
              aria-label={t.search}
              data-sheet-no-drag
            >
              {list.map((p) => {
                const selected = picked?.id === p.id
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => setPicked(selected ? null : p)}
                      className={cn(
                        'active:bg-fill flex min-h-[3.5rem] w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150',
                        selected && 'bg-accent/10',
                      )}
                    >
                      <Avatar photo={p.photo} alt={p.name} size={44} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[16px] font-medium tracking-[-0.01em]">
                          {p.name}
                        </span>
                        <span className="text-muted truncate text-sm">@{p.username}</span>
                      </span>
                      <span
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
                          selected
                            ? 'bg-accent border-accent text-accent-foreground'
                            : 'border-border',
                        )}
                        aria-hidden
                      >
                        {selected && <Check className="size-4" />}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <Field
            label={t.noteLabel}
            htmlFor="mm-note"
            hint={fmt(t.noteCount, { count: note.length, max: NOTE_MAX })}
          >
            <Textarea
              id="mm-note"
              value={note}
              maxLength={NOTE_MAX}
              placeholder={t.notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-20"
            />
          </Field>
          <p className="text-muted text-sm">{t.reward}</p>
          <FormError message={errorText(error)} />
        </div>
      )}
    </Modal>
  )
}
