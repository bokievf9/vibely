'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { UserRoundX } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { VerifiedBadge } from '@/components/ui/verified-badge'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { loadAuthorCard } from '../actions'
import type { AuthorCard } from '../types'

type Props = { userId: string; name: string; open: boolean; onClose: () => void }

// Swiping the photo strip must not scroll the sheet or the page behind it.
const STRIP =
  '-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-5 [scrollbar-width:none]'

// Read-only mini profile of a named author: photos, name, age, verified, bio. No location.
export function AuthorSheet({ userId, name, open, onClose }: Props) {
  const { dict } = useI18n()
  const [card, setCard] = useState<AuthorCard | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open || card) return
    let alive = true
    void loadAuthorCard(userId).then((r) => {
      if (!alive) return
      if (r.ok) setCard(r.data)
      else setFailed(true)
    })
    return () => {
      alive = false
    }
  }, [open, card, userId])

  return (
    <Modal open={open} onClose={onClose} title={name}>
      {card ? (
        <div className="flex flex-col gap-3">
          {card.photos.length > 0 && (
            <div className={STRIP}>
              {card.photos.map((p) => (
                <Image
                  key={p.url}
                  src={p.url}
                  alt=""
                  width={p.width}
                  height={p.height}
                  sizes="(max-width: 640px) 80vw, 320px"
                  draggable={false}
                  className="aspect-[3/4] w-4/5 shrink-0 snap-center rounded-2xl object-cover"
                />
              ))}
            </div>
          )}
          <p className="flex min-w-0 items-center gap-1.5 text-lg font-bold">
            <span className="min-w-0 wrap-anywhere">
              {card.name}
              {card.age !== null && `, ${fmt(dict.feed.ageYears, { age: card.age })}`}
            </span>
            {card.verified && <VerifiedBadge size={20} />}
          </p>
          <p className="text-muted -mt-2 truncate text-sm">@{card.username}</p>
          {card.bio && <p className="text-sm wrap-anywhere whitespace-pre-wrap">{card.bio}</p>}
        </div>
      ) : failed ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <UserRoundX className="text-muted size-10" aria-hidden />
          <p className="text-muted text-sm">{dict.feed.profileFailed}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3" role="status" aria-label={dict.common.loading}>
          <div className={STRIP}>
            <Skeleton className="bg-border/60 aspect-[3/4] w-4/5 shrink-0" />
            <Skeleton className="bg-border/60 aspect-[3/4] w-4/5 shrink-0" />
          </div>
          <Skeleton className="bg-border/60 mt-1 h-5 w-40 rounded-full" />
          <Skeleton className="bg-border/60 h-3.5 w-24 rounded-full" />
          <Skeleton className="bg-border/60 h-3.5 w-full rounded-full" />
        </div>
      )}
    </Modal>
  )
}
