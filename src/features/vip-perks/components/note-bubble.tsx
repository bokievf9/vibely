'use client'

import { useState } from 'react'
import { Flag, MessageSquareHeart } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { ReportDialog } from '@/features/safety/components/report-dialog'
import type { IncomingNote } from '../types'

// A note that came with someone's like (Discover card, "Who liked you"). Reporting it hides it
// at once (20261009000290); the moderators see the text.
export function NoteBubble({
  note,
  className,
  clamp = false,
}: {
  note: IncomingNote
  className?: string
  // Grid tiles: two lines and no report button (the full card has it).
  clamp?: boolean
}) {
  const { dict } = useI18n()
  const t = dict.vipPerks.note
  const [reporting, setReporting] = useState(false)
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  // Inside a grid tile (a button) only phrasing content is allowed: spans.
  const Root = clamp ? 'span' : 'div'
  return (
    <Root
      data-no-drag={clamp ? undefined : true}
      className={cn(
        'glass-dark pointer-events-auto flex min-w-0 items-start gap-2 rounded-2xl rounded-bl-md px-3 py-2 text-white',
        className,
      )}
    >
      <MessageSquareHeart className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="block min-w-0 flex-1 text-[14px] leading-snug">
        <span className="sr-only">{fmt(t.from, { name: note.firstName })}: </span>
        <span className={cn('[overflow-wrap:anywhere]', clamp && 'line-clamp-2')}>{note.body}</span>
      </span>
      {!clamp && (
        <>
          <button
            type="button"
            onClick={() => setReporting(true)}
            aria-label={t.report}
            className="-m-1.5 flex size-8 shrink-0 items-center justify-center rounded-full text-white/60 transition-[transform,scale] duration-150 ease-out active:scale-90"
          >
            <Flag className="size-3.5" aria-hidden />
          </button>
          <ReportDialog
            open={reporting}
            onClose={() => {
              setReporting(false)
            }}
            targetType="like_note"
            targetId={note.id}
            title={t.report}
            note={t.reportNote}
            onReported={() => setHidden(true)}
          />
        </>
      )}
    </Root>
  )
}
