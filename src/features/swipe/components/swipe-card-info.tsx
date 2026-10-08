'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import { VerifiedBadge } from '@/components/ui/verified-badge'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import {
  AboutDetails,
  aboutBadges,
  aboutRows,
  PromptCards,
} from '@/features/profile/components/about-details'
import { cn } from '@/lib/utils'
import type { Candidate } from '../schemas'

// Bottom of the swipe card: name, place, a few badges; "More" opens prompts and all details.
export function SwipeCardInfo({ candidate }: { candidate: Candidate }) {
  const { dict } = useI18n()
  const [open, setOpen] = useState(false)
  const badges = aboutBadges(candidate.about, dict.about)
  const hasMore =
    candidate.prompts.length > 0 ||
    aboutRows(candidate.about, dict.about).length > badges.length ||
    Boolean(candidate.bio && candidate.bio.length > 90)

  return (
    <div
      className={cn(
        'absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-5 text-white',
        open
          ? 'pointer-events-auto max-h-[80%] overflow-y-auto overscroll-contain bg-black/85 backdrop-blur-sm'
          : 'pointer-events-none bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-20',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-3xl font-bold">
          {candidate.name}, <span className="font-normal">{candidate.age}</span>
          <VerifiedBadge size={24} className="ml-1.5 align-[-0.1em]" />
        </h2>
        {hasMore && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="pointer-events-auto mt-1 flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium"
          >
            {open ? dict.about.less : dict.about.more}
            {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        )}
      </div>
      {(candidate.city || candidate.distanceKm !== null) && (
        <p className="flex items-center gap-1 text-sm text-white/80">
          <MapPin className="size-4" aria-hidden />
          {[
            candidate.city,
            candidate.distanceKm !== null && fmt(dict.swipe.km, { km: candidate.distanceKm }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {!open && badges.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {badges.map(({ icon: Icon, label, value }) => (
            <li
              key={label}
              className="flex max-w-full items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium"
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{value}</span>
            </li>
          ))}
        </ul>
      )}
      {candidate.bio && (
        <p className={cn('text-sm text-white/90', open ? 'whitespace-pre-wrap' : 'line-clamp-2')}>
          {candidate.bio}
        </p>
      )}
      {open && (
        <div className="flex flex-col gap-3 pt-2">
          <PromptCards prompts={candidate.prompts} t={dict.about} tone="dark" />
          <AboutDetails about={candidate.about} t={dict.about} tone="dark" />
        </div>
      )}
      {candidate.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 pt-1">
          {(open ? candidate.tags : candidate.tags.slice(0, 5)).map((slug) => (
            <li key={slug} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
              {dict.tags[slug] ?? slug}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
