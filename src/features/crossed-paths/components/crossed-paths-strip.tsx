'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { EyeOff, Footprints, UserRound, X } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { hideCrossedPath, loadCrossedPaths, type CrossedPathsState } from '../actions'
import { crossedLine } from '../format'
import type { CrossedPerson } from '../types'
import { CrossedPathsSheet } from './crossed-paths-sheet'

const PROMO_KEY = 'vibely.crossedPaths.promoDismissed'
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

// Top of Discover: "You crossed paths" (small, dismissable). Loads after the deck, and renders
// nothing when the feature is unavailable (migration not applied), off and dismissed, or empty.
export function CrossedPathsStrip() {
  const { dict, locale } = useI18n()
  const t = dict.crossed
  const [state, setState] = useState<CrossedPathsState>(null)
  const [hidden, setHidden] = useState(true)
  const [sheet, setSheet] = useState(false)

  const load = () =>
    loadCrossedPaths()
      .then((next) => {
        setState(next)
        if (!next) return
        setHidden(
          next.enabled
            ? next.people.length === 0 || read(DISMISSED_KEY) === signature(next.people)
            : read(PROMO_KEY) === '1',
        )
      })
      .catch(() => setState(null))

  useEffect(() => {
    void load()
  }, [])

  const dismiss = () => {
    if (!state) return
    write(state.enabled ? DISMISSED_KEY : PROMO_KEY, state.enabled ? signature(state.people) : '1')
    setHidden(true)
  }

  const hidePerson = (id: string) => {
    setState((s) => s && { ...s, people: s.people.filter((p) => p.id !== id) })
    void hideCrossedPath(id)
  }

  const visible = Boolean(state && !hidden && (!state.enabled || state.people.length > 0))

  return (
    <>
      <AnimatePresence initial={false}>
        {visible && state && (
          <motion.section
            key={state.enabled ? 'people' : 'promo'}
            aria-label={state.enabled ? t.title : t.promoTitle}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: 0.28, ease: EASE_OUT } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
            className="-mx-4 overflow-hidden"
          >
            {state.enabled ? (
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center justify-between px-4">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Footprints className="text-accent size-4" aria-hidden />
                    {t.title}
                  </h2>
                  <DismissButton label={t.dismiss} onClick={dismiss} />
                </div>
                <ul className="flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [&::-webkit-scrollbar]:hidden">
                  <AnimatePresence initial={false}>
                    {state.people.map((person) => (
                      <motion.li
                        key={person.id}
                        layout
                        exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
                        className="relative w-60 shrink-0 snap-start"
                      >
                        <LocaleLink
                          href={`/profile/${person.id}?from=discover`}
                          aria-label={fmt(t.open, { name: person.name })}
                          className="bg-surface border-border active:bg-border flex h-full items-center gap-3 rounded-2xl border p-2.5 pr-10 transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.98]"
                        >
                          <Avatar person={person} />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-semibold">
                              {person.name}, <span className="font-normal">{person.age}</span>
                            </span>
                            <span className="text-muted line-clamp-2 text-xs leading-snug">
                              {crossedLine(t, locale, person)}
                            </span>
                          </span>
                        </LocaleLink>
                        <button
                          type="button"
                          onClick={() => hidePerson(person.id)}
                          aria-label={fmt(t.hideLabel, { name: person.name })}
                          title={t.hide}
                          className="text-muted active:bg-border/70 absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.92]"
                        >
                          <EyeOff className="size-4" aria-hidden />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            ) : (
              <div className="px-4 pt-1">
                <div className="bg-surface border-border flex items-center gap-3 rounded-2xl border p-3">
                  <span className="bg-accent/15 text-accent flex size-9 shrink-0 items-center justify-center rounded-full">
                    <Footprints className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold">{t.promoTitle}</span>
                    <span className="text-muted text-xs leading-snug">{t.promoText}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSheet(true)}
                    className="text-accent active:bg-accent/10 relative h-9 shrink-0 rounded-full px-3 text-sm font-semibold transition-[transform,scale,background-color] duration-150 ease-out before:absolute before:-inset-1 active:scale-[0.96]"
                  >
                    {t.promoAction}
                  </button>
                  <DismissButton label={t.dismiss} onClick={dismiss} />
                </div>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
      <CrossedPathsSheet
        open={sheet}
        onClose={() => setSheet(false)}
        onEnabled={() => void load()}
      />
    </>
  )
}

function DismissButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-muted active:bg-border/70 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-full transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.92]"
    >
      <X className="size-4" aria-hidden />
    </button>
  )
}

function Avatar({ person }: { person: CrossedPerson }) {
  if (!person.photo) {
    return (
      <span className="bg-border/60 text-muted flex size-12 shrink-0 items-center justify-center rounded-full">
        <UserRound className="size-6" aria-hidden />
      </span>
    )
  }
  return (
    <Image
      src={person.photo.url}
      alt=""
      width={96}
      height={96}
      sizes="48px"
      className="size-12 shrink-0 rounded-full object-cover"
    />
  )
}
