'use client'

import { useState } from 'react'
import { ChevronRight, Footprints } from 'lucide-react'
import { groupedRowClassName } from '@/components/ui/grouped'
import { useI18n } from '@/i18n/client'
import { CrossedPathsSheet } from './crossed-paths-sheet'

// Profile page: the opt-in invitation for Crossed paths (it used to sit on top of Discover). One
// row in the grouped list; the sheet explains the feature and turns it on. Rendered by the server
// only while the feature exists and is off; gone for this view once turned on.
export function CrossedPathsPromoRow() {
  const { dict } = useI18n()
  const t = dict.crossed
  const [sheet, setSheet] = useState(false)
  const [enabled, setEnabled] = useState(false)
  return (
    <>
      {!enabled && (
        <button type="button" className={groupedRowClassName} onClick={() => setSheet(true)}>
          <span className="icon-tile bg-accent/15 text-accent">
            <Footprints className="size-[1.125rem]" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col text-left">
            <span className="truncate">{t.promoTitle}</span>
            <span className="text-muted text-footnote line-clamp-2 font-normal">{t.promoText}</span>
          </span>
          <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
        </button>
      )}
      <CrossedPathsSheet
        open={sheet}
        onClose={() => setSheet(false)}
        onEnabled={() => setEnabled(true)}
      />
    </>
  )
}
