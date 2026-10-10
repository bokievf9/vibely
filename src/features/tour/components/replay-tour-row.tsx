'use client'

import { ChevronRight, Compass } from 'lucide-react'
import { groupedRowClassName } from '@/components/ui/grouped'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { useTour } from './tour-provider'

// Settings, Help: "Replay the tour". The tour starts on Discover (it navigates there itself).
export function ReplayTourRow() {
  const { dict } = useI18n()
  const t = dict.tour.settings
  const tour = useTour()
  if (!tour) return null
  return (
    <button type="button" onClick={tour.replay} className={cn(groupedRowClassName, 'text-left')}>
      <span className="icon-tile bg-accent/15 text-accent">
        <Compass className="size-[1.125rem]" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{t.replay}</span>
        <span className="text-muted text-footnote font-normal text-pretty">{t.replayHint}</span>
      </span>
      <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
    </button>
  )
}
