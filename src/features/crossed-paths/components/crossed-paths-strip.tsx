'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { EyeOff, Footprints, UserRound, X } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { hideCrossedPath, loadCrossedPaths, type CrossedPathsState } from '../actions'
import { crossedLine } from '../format'
import type { CrossedPerson } from '../types'

const DISMISSED_KEY = 'vibely.crossedPaths.dismissed'
const EASE_OUT = [0.23, 1, 0.32, 1] as const

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not remembered; hidden for this visit only.
  }
}

// Dismissing hides the strip until someone new shows up.
const signature = (people: CrossedPerson[]) =>
  people
    .map((p) => p.id)
    .sort()
    .join(',')

// Top of Discover: "You crossed paths" (small, dismissable). Loads after the deck and shows only
// actual encounters: nothing while the feature is unavailable, off, dismissed or empty. The opt-in
// invitation lives in Settings and on the profile page (CrossedPathsPromoRow), not on Discover,
// so the deck keeps its room.
export function CrossedPathsStrip() {
  const { dict, locale } = useI18n()
  const t = dict.crossed
  const [state, setState] = useState<CrossedPathsState>(null)
  const [hidden, setHidden] = useState(true)
  useEffect(() => {
    loadCrossedPaths()
      .then((next) => {
        setState(next)
        if (!next) return
        setHidden(
          !next.enabled ||
            next.people.length === 0 ||
            read(DISMISSED_KEY) === signature(next.people),
        )
      })
      .catch(() => setState(null))
  }, [])

  const dismiss = () => {
    if (!state) return
    write(DISMISSED_KEY, signature(state.people))
    setHidden(true)
  }

  const hidePerson = (id: string) => {
    setState((s) => s && { ...s, people: s.people.filter((p) => p.id !== id) })
    void hideCrossedPath(id)
  }

  const visible = Boolean(state?.enabled && !hidden && state.people.length > 0)

  return (
    <AnimatePresence initial={false}>
      {visible && state && (
        <motion.section
          aria-label={t.title}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto', transition: { duration: 0.28, ease: EASE_OUT } }}
          exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
          className="-mx-3 shrink-0 overflow-hidden"
        >
          {/* One compact row: a title tile, then people. Kept short so the deck keeps its room. */}
          <ul className="flex snap-x snap-mandatory scroll-px-3 [scrollbar-width:none] gap-2 overflow-x-auto overscroll-x-contain px-3 py-1 [&::-webkit-scrollbar]:hidden">
            <li className="bg-accent/10 text-accent highlight relative flex w-24 shrink-0 snap-start flex-col justify-between rounded-2xl p-2.5">
              <Footprints className="size-4" aria-hidden />
              <h2 className="text-footnote pr-1 leading-tight font-semibold">{t.title}</h2>
              <DismissButton label={t.dismiss} onClick={dismiss} className="top-0.5 right-0.5" />
            </li>
            <AnimatePresence initial={false}>
              {state.people.map((person) => (
                <motion.li
                  key={person.id}
                  layout
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
                  className="relative w-56 shrink-0 snap-start"
                >
                  <LocaleLink
                    href={`/profile/${person.id}?from=discover`}
                    aria-label={`${fmt(t.open, { name: person.name })}. ${crossedLine(t, locale, person)}`}
                    className="card active:bg-fill flex h-full items-center gap-2.5 rounded-2xl p-2 transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.98]"
                  >
                    <Avatar person={person} />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-callout truncate pr-6 font-semibold">
                        {person.name}, <span className="font-normal">{person.age}</span>
                      </span>
                      <span className="text-muted text-caption line-clamp-2 leading-snug">
                        {crossedLine(t, locale, person, true)}
                      </span>
                    </span>
                  </LocaleLink>
                  <button
                    type="button"
                    onClick={() => hidePerson(person.id)}
                    aria-label={fmt(t.hideLabel, { name: person.name })}
                    title={t.hide}
                    className="text-muted active:bg-fill absolute top-0.5 right-0.5 flex size-8 items-center justify-center rounded-full transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.92]"
                  >
                    <EyeOff className="size-3.5" aria-hidden />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

function DismissButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'text-muted active:bg-fill flex size-8 shrink-0 items-center justify-center rounded-full transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.92]',
        className && `absolute ${className}`,
      )}
    >
      <X className="size-4" aria-hidden />
    </button>
  )
}

function Avatar({ person }: { person: CrossedPerson }) {
  if (!person.photo) {
    return (
      <span className="bg-fill text-muted flex size-11 shrink-0 items-center justify-center rounded-full">
        <UserRound className="size-5" aria-hidden />
      </span>
    )
  }
  return (
    <Image
      src={person.photo.url}
      alt=""
      width={88}
      height={88}
      sizes="44px"
      className="size-11 shrink-0 rounded-full object-cover"
    />
  )
}
