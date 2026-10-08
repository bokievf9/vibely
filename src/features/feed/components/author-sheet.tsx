'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { BadgeCheck } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/spinner'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { loadAuthorCard } from '../actions'
import type { AuthorCard } from '../types'

type Props = { userId: string; name: string; open: boolean; onClose: () => void }

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
            <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1">
              {card.photos.map((p) => (
                <Image
                  key={p.url}
                  src={p.url}
                  alt=""
                  width={p.width}
                  height={p.height}
                  sizes="(max-width: 640px) 80vw, 320px"
                  className="aspect-[3/4] w-4/5 shrink-0 snap-center rounded-2xl object-cover"
                />
              ))}
            </div>
          )}
          <p className="flex items-center gap-1.5 text-lg font-bold">
            {card.name}
            {card.age !== null && `, ${fmt(dict.feed.ageYears, { age: card.age })}`}
            {card.verified && (
              <BadgeCheck className="text-accent size-5" aria-label={dict.feed.verified} />
            )}
          </p>
          {card.bio && <p className="text-sm whitespace-pre-wrap">{card.bio}</p>}
        </div>
      ) : failed ? (
        <p className="text-muted text-sm">{dict.feed.profileFailed}</p>
      ) : (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
    </Modal>
  )
}
