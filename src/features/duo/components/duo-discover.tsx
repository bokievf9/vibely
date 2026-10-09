'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Heart, Inbox, PencilLine, RefreshCw, UsersRound, X } from 'lucide-react'
import { EmptyState } from '@/components/layout/empty-state'
import { headerActionClassName } from '@/components/layout/header-styles'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { LocaleLink, useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { DeckSkeleton } from '@/features/swipe/components/deck-skeleton'
import { decideDuo, loadDuoCandidates, loadDuoInbox, refreshMyDuo } from '../actions'
import { onDuoSignal } from '../signal'
import type { DuoCandidate, DuoPerson, MyDuo } from '../types'
import { DuoCard } from './duo-card'
import { DuoInbox } from './duo-inbox'
import { DuoMatchModal, type DuoMatchInfo } from './duo-match-modal'
import { DuoSetup } from './duo-setup'
import { DiscoverModeToggle } from './mode-toggle'

type Props = {
  initial: MyDuo
  me: DuoPerson | null
  openInbox?: boolean
  // Server-rendered header buttons shared with Solo mode (search, plans).
  headerActions?: ReactNode
}

const passButton =
  'size-[3.75rem] rounded-full border border-border bg-surface-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_10px_24px_-12px_rgb(0_0_0/0.9)] active:scale-[0.9] active:bg-fill'
const likeButton =
  'size-[4.75rem] rounded-full active:scale-[0.9] shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-2px_0_rgb(0_0_0/0.12),0_14px_32px_-10px_rgb(255_77_125/0.7)]'

// Discover in Duo mode: the setup (no active duo yet) or the Duo deck with the duo inbox.
export function DuoDiscover({ initial, me, openInbox = false, headerActions }: Props) {
  const { dict } = useI18n()
  const t = dict.duo
  const [duo, setDuo] = useState(initial)
  const [inboxOpen, setInboxOpen] = useState(openInbox)
  const [inboxVersion, setInboxVersion] = useState(0)
  const [unseenLikes, setUnseenLikes] = useState(false)
  const [match, setMatch] = useState<DuoMatchInfo | null>(null)
  const active = duo.team?.status === 'active' ? duo.team : null
  const ours = [...(me ? [me] : []), ...(active?.partner ? [active.partner] : [])]
  const oursRef = useRef(ours)
  useEffect(() => {
    oursRef.current = ours
  })

  // Invites, acceptances, a dissolved duo, partner likes and matches arrive live.
  useEffect(
    () =>
      onDuoSignal(async (signal) => {
        if (signal.kind === 'like') {
          setUnseenLikes(true)
          setInboxVersion((v) => v + 1)
          return
        }
        if (signal.kind === 'match') {
          const inbox = await loadDuoInbox()
          const item = inbox.ok ? inbox.data.find((i) => i.groupId === signal.group_id) : null
          setMatch({ groupId: signal.group_id, ours: oursRef.current, theirs: item?.members ?? [] })
          setInboxVersion((v) => v + 1)
          return
        }
        const fresh = await refreshMyDuo()
        if (fresh.ok) setDuo(fresh.data)
      }),
    [],
  )

  return (
    <>
      <PageHeader title={dict.swipe.title}>
        {headerActions}
        {active && (
          <>
            <button
              type="button"
              className={`${headerActionClassName} relative`}
              aria-label={t.inbox}
              onClick={() => {
                setUnseenLikes(false)
                setInboxOpen(true)
              }}
            >
              <Inbox className="size-[1.375rem]" />
              {unseenLikes && (
                <span
                  aria-hidden
                  className="bg-accent absolute top-2 right-2 size-2.5 rounded-full"
                />
              )}
            </button>
            <LocaleLink href="/duo" className={headerActionClassName} aria-label={t.editProfile}>
              <PencilLine className="size-[1.375rem]" />
            </LocaleLink>
          </>
        )}
      </PageHeader>
      <section className="flex flex-1 flex-col gap-4 px-3 pt-1 pb-3">
        <DiscoverModeToggle mode="duo" />
        {active ? (
          <DuoDeck
            key={active.id}
            onMatch={(groupId, theirs) => setMatch({ groupId, ours, theirs })}
          />
        ) : (
          <div className="px-1 pb-4">
            <DuoSetup duo={duo} onChange={setDuo} />
          </div>
        )}
      </section>
      {active && (
        <DuoInbox open={inboxOpen} onClose={() => setInboxOpen(false)} version={inboxVersion} />
      )}
      <DuoMatchModal match={match} onClose={() => setMatch(null)} />
    </>
  )
}

function DuoDeck({ onMatch }: { onMatch: (groupId: string, theirs: DuoPerson[]) => void }) {
  const { dict } = useI18n()
  const t = dict.duo
  const errorText = useErrorText()
  const [cards, setCards] = useState<DuoCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ErrorKey>()
  const [exitTo, setExitTo] = useState<-1 | 1>(1)
  const decided = useRef(new Set<string>())

  const load = useCallback(async () => {
    setLoading(true)
    const result = await loadDuoCandidates()
    setLoading(false)
    if (!result.ok) return setError(result.error)
    setError(undefined)
    setCards((prev) => {
      const seen = new Set(prev.map((c) => c.teamId))
      return [
        ...prev,
        ...result.data.filter((c) => !seen.has(c.teamId) && !decided.current.has(c.teamId)),
      ]
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadDuoCandidates().then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.ok) return setError(result.error)
      setCards(result.data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const decide = async (like: boolean) => {
    const [top, ...rest] = cards
    if (!top || decided.current.has(top.teamId)) return
    decided.current.add(top.teamId)
    setExitTo(like ? 1 : -1)
    setCards(rest)
    if (rest.length < 2 && !loading) void load()
    const result = await decideDuo({ teamId: top.teamId, like })
    if (!result.ok) return setError(result.error)
    if (result.data.matched && result.data.groupId) onMatch(result.data.groupId, top.members)
  }

  const [top, next] = cards

  return (
    <>
      <FormError message={errorText(error)} />
      {!top && loading && <DeckSkeleton />}
      {!top && !loading && (
        <EmptyState
          icon={UsersRound}
          title={t.deckEmpty}
          text={t.deckEmptyHint}
          action={
            <div className="flex flex-col items-center gap-2">
              <Button variant="secondary" onClick={() => void load()}>
                <RefreshCw className="size-5" aria-hidden /> {dict.common.retry}
              </Button>
              <LocaleLink href="/duo" className="text-accent text-sm font-semibold">
                {t.editProfile}
              </LocaleLink>
            </div>
          }
        />
      )}
      {top && (
        <>
          <div className="relative min-h-[360px] flex-1">
            <AnimatePresence custom={exitTo}>
              {[next, top].map(
                (c) => c && <DuoCard key={c.teamId} duo={c} top={c === top} exitTo={exitTo} />,
              )}
            </AnimatePresence>
          </div>
          <p className="text-muted px-2 text-center text-xs">{t.teamLike}</p>
          <div className="flex items-center justify-center gap-7">
            <Button
              variant="secondary"
              size="icon"
              className={passButton}
              aria-label={t.passDuo}
              onClick={() => void decide(false)}
            >
              <X className="size-7 text-white/90" strokeWidth={2.75} />
            </Button>
            <Button
              size="icon"
              className={likeButton}
              aria-label={t.likeDuo}
              onClick={() => void decide(true)}
            >
              <Heart className="size-9 fill-current drop-shadow-[0_1px_1px_rgb(0_0_0/0.15)]" />
            </Button>
          </div>
        </>
      )}
    </>
  )
}
