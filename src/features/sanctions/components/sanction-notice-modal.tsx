'use client'

import { useState, useSyncExternalStore } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { acknowledgeWarning } from '../actions'

export type Notice = {
  kind: 'warning' | 'mute'
  // Warning id, or the mute end (one notice per mute).
  id: string
  title: string
  body: string
  detail?: string
  ok: string
}

const MUTE_SEEN_KEY = 'vibely_mute_seen'

function muteSeen(): string | null {
  try {
    return localStorage.getItem(MUTE_SEEN_KEY)
  } catch {
    return null
  }
}

const noop = () => () => {}

export function SanctionNoticeModal({ notices }: { notices: Notice[] }) {
  // Read after hydration only: the server can't know what this device has already seen.
  const seenMute = useSyncExternalStore(noop, muteSeen, () => undefined)
  const [done, setDone] = useState<string[]>([])
  if (seenMute === undefined) return null

  const current = notices.find(
    (n) => !done.includes(n.id) && !(n.kind === 'mute' && n.id === seenMute),
  )
  if (!current) return null

  const close = () => {
    setDone((d) => [...d, current.id])
    if (current.kind === 'warning') void acknowledgeWarning(current.id)
    else {
      try {
        localStorage.setItem(MUTE_SEEN_KEY, current.id)
      } catch {
        // Private mode: the notice may show again, which is fine.
      }
    }
  }

  return (
    <Modal open onClose={close} title={current.title}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <TriangleAlert className="size-6 shrink-0 text-amber-400" aria-hidden />
          <div className="flex flex-col gap-2">
            <p>{current.body}</p>
            {current.detail && <p className="text-muted text-sm">{current.detail}</p>}
          </div>
        </div>
        <Button onClick={close} fullWidth>
          {current.ok}
        </Button>
      </div>
    </Modal>
  )
}
