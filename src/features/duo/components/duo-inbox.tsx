'use client'

import { useEffect, useState, useTransition } from 'react'
import { Heart, MessageCircle, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/spinner'
import { fmt } from '@/i18n/config'
import { LocaleLink, useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { loadDuoInbox, undoDuoLike } from '../actions'
import { undoMinutesLeft } from '../errors'
import type { DuoInboxItem } from '../types'
import { DuoAvatars } from './duo-photos'

type Props = { open: boolean; onClose: () => void; version: number }

// The team's likes of the last days: "<name> liked this duo", undo within 1 hour (either member),
// or a link to the group chat once it became a duo match.
export function DuoInbox({ open, onClose, version }: Props) {
  const { dict } = useI18n()
  const t = dict.duo
  const errorText = useErrorText()
  const [items, setItems] = useState<DuoInboxItem[] | null>(null)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void loadDuoInbox().then((r) => {
      if (cancelled) return
      if (r.ok) setItems(r.data)
      else setError(r.error)
    })
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      cancelled = true
      clearInterval(tick)
    }
  }, [open, version])

  const undo = (teamId: string) =>
    startTransition(async () => {
      const result = await undoDuoLike(teamId)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setItems((prev) => prev?.filter((i) => i.teamId !== teamId) ?? null)
    })

  return (
    <Modal open={open} onClose={onClose} title={t.inboxTitle} size="tall">
      <div className="flex flex-col gap-3">
        <FormError message={errorText(error)} />
        {items === null && !error && (
          <div className="flex justify-center py-10">
            <Spinner className="size-6" />
          </div>
        )}
        {items?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Heart className="text-accent size-8" aria-hidden />
            <p className="text-headline">{t.inboxEmpty}</p>
            <p className="text-muted max-w-xs text-sm">{t.inboxEmptyHint}</p>
          </div>
        )}
        <ul className="flex flex-col gap-2">
          {items?.map((item) => {
            const left = item.canUndo ? undoMinutesLeft(item.createdAt, now) : 0
            return (
              <li key={item.teamId} className="card-raised flex items-center gap-3 rounded-2xl p-3">
                <DuoAvatars members={item.members} size={44} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">
                    {item.members.map((m) => m.name).join(' & ')}
                  </span>
                  <span className="text-muted truncate text-sm">
                    {item.matched
                      ? t.matched
                      : item.mine
                        ? t.youLikedThisDuo
                        : fmt(t.likedThisDuo, { name: item.byName })}
                  </span>
                </div>
                {item.matched && item.groupId ? (
                  <LocaleLink
                    href={`/chats/group/${item.groupId}`}
                    aria-label={t.openGroup}
                    className="bg-accent-gradient text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-full active:scale-95"
                  >
                    <MessageCircle className="size-5" />
                  </LocaleLink>
                ) : left > 0 ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => undo(item.teamId)}
                    aria-label={`${t.undo}: ${fmt(t.undoLeft, { minutes: left })}`}
                  >
                    <Undo2 className="size-4" aria-hidden />
                    <span className="tabular-nums">{fmt(t.undoLeft, { minutes: left })}</span>
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </Modal>
  )
}
