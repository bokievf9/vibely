'use client'

import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import type { IncomingNote } from '../types'
import { NoteBubble } from './note-bubble'

// Locked "Who liked you" (the list is not shown to this viewer): notes still reach their
// recipient, with the sender's first name and a blurred placeholder instead of a photo.
export function LockedNotes({ notes }: { notes: IncomingNote[] }) {
  const { dict } = useI18n()
  return (
    <ul className="flex flex-col gap-3 px-4 pb-8">
      {notes.map((n) => (
        <li key={n.id} className="flex items-start gap-3">
          <span
            aria-hidden
            className="size-11 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgb(255_255_255/0.35),transparent_45%),linear-gradient(135deg,var(--accent),var(--accent-deep))] blur-[2px]"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-sm font-semibold">
              {fmt(dict.vipPerks.note.from, { name: n.firstName })}
            </p>
            <NoteBubble note={n} className="self-start" />
          </div>
        </li>
      ))}
    </ul>
  )
}
