'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronRight,
  Expand,
  MessagesSquare,
  RotateCw,
  SearchX,
  Shuffle,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmt, type Locale } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { loadDeckEnd, type DeckEndInfo } from '../deck-end-actions'
import type { SwipeFilters } from '../schemas'
import { InviteCard } from './invite-card'
import { NewPeopleToggle } from './new-people-toggle'

type Props = {
  filters: SwipeFilters
  onWiden: (filters: SwipeFilters) => void
  onRefresh: () => void
  onOpenFilters: () => void
  onAlertChange: (on: boolean) => void
}

function ago(minutes: number, locale: Locale) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  if (minutes < 60 * 24) return rtf.format(-Math.round(minutes / 60), 'hour')
  return rtf.format(-Math.round(minutes / (60 * 24)), 'day')
}

// "You've seen everyone nearby": widen in one tap, other ways to meet people, alerts, invites.
export function DeckEnd({ filters, onWiden, onRefresh, onOpenFilters, onAlertChange }: Props) {
  const { dict, locale } = useI18n()
  const t = dict.discover
  const [info, setInfo] = useState<DeckEndInfo | null>(null)

  useEffect(() => {
    let active = true
    void loadDeckEnd(filters).then((r) => {
      if (!active || !r.ok) return
      setInfo(r.data)
      onAlertChange(r.data.alertOn)
    })
    return () => {
      active = false
    }
  }, [filters, onAlertChange])

  const widen = [
    info?.widerKm &&
      fmt(t.widerKm, { km: info.widerKm.filters.maxKm - filters.maxKm, count: info.widerKm.extra }),
    info?.widerAge &&
      fmt(t.widerAge, {
        min: info.widerAge.filters.minAge,
        max: info.widerAge.filters.maxAge,
        count: info.widerAge.extra,
      }),
  ]
  const options = [info?.widerKm, info?.widerAge]

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <SearchX className="text-muted size-12" aria-hidden />
        <h2 className="text-xl font-semibold">{t.emptyTitle}</h2>
        <p className="text-muted max-w-xs text-sm">{t.emptyText}</p>
      </div>
      {options.map(
        (o, i) =>
          o && (
            <Button key={i} variant="secondary" fullWidth onClick={() => onWiden(o.filters)}>
              <Expand className="size-5" aria-hidden /> {widen[i]}
            </Button>
          ),
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onRefresh}>
          <RotateCw className="size-5" aria-hidden /> {dict.swipe.refresh}
        </Button>
        <Button variant="secondary" onClick={onOpenFilters}>
          <SlidersHorizontal className="size-5" aria-hidden /> {dict.swipe.filters}
        </Button>
      </div>
      <p className="text-muted text-center text-xs">{t.secondChanceHint}</p>
      <LinkCard
        href="/randomizer"
        icon={Shuffle}
        title={t.random}
        text={info?.searching ? fmt(t.randomCount, { count: info.searching }) : t.randomIdle}
      />
      <LinkCard
        href="/feed"
        icon={MessagesSquare}
        title={t.feed}
        text={
          info && info.newestPostMinutes !== null
            ? fmt(t.feedNewest, { time: ago(info.newestPostMinutes, locale) })
            : t.feedEmpty
        }
      />
      {info && (
        <NewPeopleToggle initialOn={info.alertOn} filters={filters} onChange={onAlertChange} />
      )}
      {info?.invite && <InviteCard code={info.invite.code} invited={info.invite.invited} />}
    </div>
  )
}

type LinkCardProps = { href: string; icon: LucideIcon; title: string; text: ReactNode }

function LinkCard({ href, icon: Icon, title, text }: LinkCardProps) {
  return (
    <LocaleLink
      href={href}
      className="bg-surface border-border active:bg-border flex items-center gap-3 rounded-2xl border p-4"
    >
      <Icon className="text-accent size-6 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-muted truncate text-sm">{text}</span>
      </span>
      <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
    </LocaleLink>
  )
}
