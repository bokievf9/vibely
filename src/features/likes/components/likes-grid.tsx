'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AnimatePresence } from 'framer-motion'
import { HeartHandshake, UserRound } from 'lucide-react'
import { EmptyState } from '@/components/layout/empty-state'
import { FormError } from '@/components/ui/field'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { trackOnce } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { swipe } from '@/features/swipe/actions'
import { MatchModal, type MatchInfo } from '@/features/swipe/components/match-modal'
import type { Candidate } from '@/features/swipe/schemas'
import { LikeSheet } from './like-sheet'

// "Who liked you": a photo grid; tapping opens the full card with Pass / Like back.
// Like back goes through the normal swipe() action, so the DB trigger creates the match at once.
export function LikesGrid({ initial }: { initial: Candidate[] }) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [people, setPeople] = useState(initial)
  const [open, setOpen] = useState<Candidate | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [match, setMatch] = useState<MatchInfo | null>(null)

  const decide = async (person: Candidate, direction: 'like' | 'pass') => {
    setBusy(true)
    const result = await swipe({ targetId: person.id, direction })
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setError(undefined)
    setPeople((list) => list.filter((p) => p.id !== person.id))
    setOpen(null)
    if (!result.data.matchId) return
    trackOnce('first_match')
    setMatch({ id: result.data.matchId, name: person.name, photo: person.photos[0]?.url ?? null })
  }

  return (
    <section className="flex flex-1 flex-col gap-4 px-4 pb-4">
      <FormError message={errorText(error)} />
      {people.length === 0 ? (
        <EmptyState icon={HeartHandshake} title={dict.likes.empty} text={dict.likes.emptyHint} />
      ) : (
        <>
          <p className="text-muted text-sm">{dict.likes.hint}</p>
          <ul className="grid grid-cols-2 gap-3">
            {people.map((person, i) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => setOpen(person)}
                  aria-label={fmt(dict.likes.view, { name: person.name })}
                  className="bg-surface relative block aspect-[3/4] w-full overflow-hidden rounded-2xl text-left transition-transform duration-150 ease-out active:scale-[0.97]"
                >
                  <GridPhoto person={person} eager={i < 4} />
                  <span className="absolute inset-x-0 bottom-0 flex min-w-0 items-baseline bg-gradient-to-t from-black/85 to-transparent p-3 pt-10 font-semibold text-white">
                    <span className="truncate">{person.name}</span>
                    <span className="shrink-0 font-normal">, {person.age}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <AnimatePresence>
        {open && (
          <LikeSheet
            key={open.id}
            person={open}
            busy={busy}
            onDecide={(direction) => void decide(open, direction)}
            onClose={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
      <MatchModal match={match} onClose={() => setMatch(null)} />
    </section>
  )
}

function GridPhoto({ person, eager }: { person: Candidate; eager: boolean }) {
  const [loaded, setLoaded] = useState(false)
  const photo = person.photos[0]
  if (!photo) {
    return (
      <span className="text-muted flex size-full items-center justify-center">
        <UserRound className="size-12" aria-hidden />
      </span>
    )
  }
  return (
    <Image
      src={photo.url}
      alt=""
      width={photo.width}
      height={photo.height}
      sizes="(max-width: 448px) 50vw, 224px"
      loading={eager ? 'eager' : 'lazy'}
      onLoad={() => setLoaded(true)}
      className={cn(
        'size-full object-cover transition-opacity duration-300 ease-out',
        loaded ? 'opacity-100' : 'opacity-0',
      )}
    />
  )
}
