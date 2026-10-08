'use client'

import { useState } from 'react'
import { Flag, LogOut, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { ReportDialog } from '@/features/safety/components/report-dialog'
import type { RandomSession } from '../types'
import { RevealPanel } from './reveal-panel'

type Props = {
  session: RandomSession
  active: boolean
  pending: boolean
  onReveal: () => void
  onEnd: () => Promise<void>
  onNext: () => void
}

// Who you're talking to, shared interests, reveal consent, report and end.
export function SessionBar({ session, active, pending, onReveal, onEnd, onNext }: Props) {
  const { dict } = useI18n()
  const [dialog, setDialog] = useState<'end' | 'next' | 'report' | null>(null)

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">
          {session.partner?.name ?? dict.random.connected}
        </p>
        <div className="flex shrink-0 gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={dict.safety.report}
            onClick={() => setDialog('report')}
          >
            <Flag className="size-5" />
          </Button>
          {active && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={dict.random.skip}
              onClick={() => setDialog('next')}
            >
              <SkipForward className="size-5" />
            </Button>
          )}
          {active && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={dict.random.end}
              onClick={() => setDialog('end')}
            >
              <LogOut className="size-5" />
            </Button>
          )}
        </div>
      </div>
      {session.commonTags.length > 0 && !session.partner && (
        <p className="text-muted text-xs">
          {fmt(dict.random.commonTags, {
            tags: session.commonTags.map((t) => dict.tags[t] ?? t).join(', '),
          })}
        </p>
      )}
      {/* Stays after the chat ends (inert) so the conversation below does not jump up. */}
      <RevealPanel session={session} pending={pending} disabled={!active} onReveal={onReveal} />
      <Modal open={dialog === 'end'} onClose={() => setDialog(null)} title={dict.random.end}>
        <div className="flex flex-col gap-4">
          <p>{dict.random.endConfirm}</p>
          <Button
            variant="danger"
            // TODO(ui/shell): swap for the danger token once it lands.
            className="bg-danger-strong"
            fullWidth
            loading={pending}
            onClick={async () => {
              await onEnd()
              setDialog(null)
            }}
          >
            {dict.random.end}
          </Button>
        </div>
      </Modal>
      <Modal open={dialog === 'next'} onClose={() => setDialog(null)} title={dict.random.skip}>
        <div className="flex flex-col gap-4">
          <p>{dict.random.skipConfirm}</p>
          <Button
            fullWidth
            onClick={() => {
              setDialog(null)
              onNext()
            }}
          >
            <SkipForward className="size-5" /> {dict.random.next}
          </Button>
        </div>
      </Modal>
      {dialog === 'report' && (
        <ReportDialog
          open
          onClose={() => setDialog(null)}
          targetType="random_session"
          targetId={session.id}
        />
      )}
    </>
  )
}
