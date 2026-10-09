'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { Check, Copy, Link2, Search, Share2, Sparkles, UserPlus, UsersRound } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { fmt, localePath } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { searchPeople } from '@/features/username/actions'
import type { SearchResult } from '@/features/username/schemas'
import { acceptDuo, declineDuo, inviteToDuo, leaveDuo, refreshMyDuo } from '../actions'
import type { MyDuo } from '../types'

type Props = { duo: MyDuo; onChange: (duo: MyDuo) => void }

// No active duo yet: invites waiting for me, my own pending invite, or the ways to invite a
// friend (by @username or with a link).
export function DuoSetup({ duo, onChange }: Props) {
  const { dict } = useI18n()
  const t = dict.duo
  const errorText = useErrorText()
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const run = (task: () => Promise<{ ok: boolean; error?: ErrorKey }>) =>
    startTransition(async () => {
      const result = await task()
      if (!result.ok) setError(result.error)
      else setError(undefined)
      const fresh = await refreshMyDuo()
      if (fresh.ok) onChange(fresh.data)
    })

  const team = duo.team?.status === 'pending' ? duo.team : null

  return (
    <div className="flex flex-col gap-5">
      {duo.invites.length > 0 && (
        <section aria-labelledby="duo-invites" className="flex flex-col gap-2">
          <h2 id="duo-invites" className="text-headline px-1">
            {t.invitesTitle}
          </h2>
          <ul className="flex flex-col gap-2">
            {duo.invites.map((inv) => (
              <li key={inv.teamId} className="card-raised flex items-center gap-3 rounded-2xl p-3">
                <Avatar photo={inv.from.photo} alt={inv.from.name} size={48} />
                <p className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
                  {fmt(t.inviteFrom, { name: inv.from.name })}
                </p>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => declineDuo(inv.teamId))}
                  >
                    {t.decline}
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => acceptDuo({ teamId: inv.teamId }))}
                  >
                    {t.accept}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!team && <Pitch />}

      <FormError message={errorText(error)} />

      {team ? (
        <PendingInvite
          name={team.partner?.name ?? null}
          photo={team.partner?.photo ?? null}
          code={team.code}
          pending={pending}
          onCancel={() => run(leaveDuo)}
        />
      ) : (
        <InviteFriend
          pending={pending}
          onInvite={(id) => run(() => inviteToDuo(id))}
          onLink={() => run(() => inviteToDuo(null))}
        />
      )}
    </div>
  )
}

function Pitch() {
  const { dict } = useI18n()
  const t = dict.duo
  return (
    <section className="flex flex-col gap-3 px-1">
      <span
        aria-hidden
        className="bg-accent-gradient text-accent-foreground flex size-14 items-center justify-center rounded-[1.25rem] shadow-[0_12px_28px_-12px_rgb(255_77_125/0.8)]"
      >
        <UsersRound className="size-7" />
      </span>
      <h2 className="text-[1.75rem] leading-tight font-bold tracking-[-0.025em]">{t.setupTitle}</h2>
      <p className="text-muted">{t.setupText}</p>
      <ul className="flex flex-col gap-2 pt-1 text-sm">
        {[t.pointFriend, t.pointDeck, t.pointGroup, t.pointLeave].map((p) => (
          <li key={p} className="flex gap-2.5">
            <Sparkles className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function InviteFriend({
  pending,
  onInvite,
  onLink,
}: {
  pending: boolean
  onInvite: (userId: string) => void
  onLink: () => void
}) {
  const { dict } = useI18n()
  const t = dict.duo
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const q = query.trim()
    const id = ++seq.current
    if (q.replace(/^@+/, '').length < 2) return
    const timer = setTimeout(async () => {
      const result = await searchPeople(q.replace(/^@+/, ''))
      if (id !== seq.current) return
      setResults(result.ok ? result.data : [])
      setSearched(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const short = query.trim().replace(/^@+/, '').length < 2

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="duo-by-username" className="flex flex-col gap-2">
        <h2 id="duo-by-username" className="text-headline px-1">
          {t.inviteByUsername}
        </h2>
        <label className="relative block">
          <span className="sr-only">{t.searchFriend}</span>
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            inputMode="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t.searchFriend}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSearched(false)
            }}
            className="pl-11"
          />
        </label>
        {!short && searched && results.length === 0 && (
          <p className="text-muted px-1 text-sm">{t.noResults}</p>
        )}
        {!short && results.length > 0 && (
          <ul className="flex flex-col gap-1">
            {results.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
                <Avatar photo={r.photo} alt={r.name} size={44} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">
                    {r.name}, {r.age}
                  </span>
                  <span className="text-muted truncate text-sm">@{r.username}</span>
                </span>
                <Button size="sm" disabled={pending} onClick={() => onInvite(r.id)}>
                  <UserPlus className="size-4" aria-hidden /> {t.invite}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="duo-by-link" className="flex flex-col gap-2">
        <h2 id="duo-by-link" className="text-headline px-1">
          {t.inviteLink}
        </h2>
        <p className="text-muted px-1 text-sm">{t.linkHint}</p>
        <Button variant="secondary" fullWidth loading={pending} onClick={onLink}>
          <Link2 className="size-5" aria-hidden /> {t.createLink}
        </Button>
      </section>
    </div>
  )
}

function PendingInvite({
  name,
  photo,
  code,
  pending,
  onCancel,
}: {
  name: string | null
  photo: { url: string; width: number; height: number } | null
  code: string | null
  pending: boolean
  onCancel: () => void
}) {
  const { dict, locale } = useI18n()
  const t = dict.duo
  const [copied, setCopied] = useState(false)
  // Client-only values (no hydration mismatch): the page origin and Web Share support.
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => null,
  )
  const canShare = useSyncExternalStore(
    noop,
    () => 'share' in navigator,
    () => false,
  )
  const link = code && origin ? `${origin}${localePath(locale, `/duo/join/${code}`)}` : null

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  const share = async () => {
    if (!link) return
    try {
      await navigator.share({ title: t.setupTitle, url: link })
    } catch {
      // Dismissed: nothing to do.
    }
  }

  return (
    <section className="card-raised flex flex-col gap-4 rounded-3xl p-5">
      <div className="flex items-center gap-3">
        {name ? (
          <Avatar photo={photo} alt={name} size={52} />
        ) : (
          <span className="bg-accent/15 text-accent flex size-[52px] items-center justify-center rounded-full">
            <Link2 className="size-6" aria-hidden />
          </span>
        )}
        <div className="flex min-w-0 flex-col">
          <h2 className="text-headline [overflow-wrap:anywhere]">
            {name ? fmt(t.pendingTitle, { name }) : t.pendingLinkTitle}
          </h2>
          <p className="text-muted text-sm">{name ? t.pendingHint : t.linkHint}</p>
        </div>
      </div>
      {!name && link && (
        <div className="flex flex-col gap-2">
          <p className="bg-surface rounded-xl px-3 py-2.5 font-mono text-sm break-all select-all">
            {link}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => void copy()}>
              {copied ? (
                <Check className="size-5" aria-hidden />
              ) : (
                <Copy className="size-5" aria-hidden />
              )}
              {copied ? t.copied : t.copyLink}
            </Button>
            {canShare && (
              <Button className="flex-1" onClick={() => void share()}>
                <Share2 className="size-5" aria-hidden /> {t.shareLink}
              </Button>
            )}
          </div>
        </div>
      )}
      <Button variant="ghost" fullWidth disabled={pending} onClick={onCancel}>
        {t.cancelInvite}
      </Button>
    </section>
  )
}

const noop = () => () => {}
