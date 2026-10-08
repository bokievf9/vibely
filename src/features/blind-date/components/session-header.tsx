'use client'

import { useState, useTransition } from 'react'
import { Ban, Flag, Heart, MoreHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { HeaderEdge, headerBarClassName } from '@/components/layout/header-styles'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { ReportDialog } from '@/features/safety/components/report-dialog'
import type { BlindSession } from '../types'
import { AliasAvatar } from './alias-avatar'

type Props = {
  session: BlindSession
  pending: boolean
  onConnect: () => void
  onPass: () => Promise<void>
  onBlock: () => Promise<void>
}

// Who you are talking to (alias + abstract avatar), report/block, and the Connect / Pass bar that
// stays reachable under the header for the whole conversation.
export function SessionHeader({ session, pending, onConnect, onPass, onBlock }: Props) {
  const { dict } = useI18n()
  const t = dict.blindDate
  const [dialog, setDialog] = useState<'menu' | 'pass' | 'block' | 'report' | null>(null)
  const [busy, startBusy] = useTransition()
  const active = session.state === 'active'
  const hint = session.commonTags.length
    ? fmt(t.commonTags, {
        tags: session.commonTags.map((tag) => dict.tags[tag] ?? tag).join(', '),
      })
    : t.anonymousHint

  return (
    <>
      <header className={cn(headerBarClassName, 'gap-3 px-4')}>
        <AliasAvatar alias={session.partnerAlias} size={36} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base leading-tight font-semibold">
            {fmt(t.partner, { n: session.partnerAlias })}
          </h1>
          <p className="text-muted truncate text-xs">{hint}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="-mr-2 size-11"
          aria-label={t.more}
          onClick={() => setDialog('menu')}
        >
          <MoreHorizontal className="size-5" />
        </Button>
        <HeaderEdge />
      </header>

      {active && (
        <div className="bg-background/95 border-border sticky top-[var(--header-h)] z-20 border-b px-4 py-2 backdrop-blur">
          {session.myDecision === true ? (
            <div className="flex min-h-11 items-center gap-3" role="status">
              <span className="relative flex size-2.5 shrink-0" aria-hidden>
                <span className="bg-accent absolute inline-flex size-full animate-ping rounded-full opacity-60" />
                <span className="bg-accent relative inline-flex size-2.5 rounded-full" />
              </span>
              <p className="min-w-0 flex-1 text-sm">{t.waiting}</p>
              <Button size="sm" variant="ghost" onClick={() => setDialog('pass')}>
                {t.pass}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_1.4fr] gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-11"
                disabled={pending}
                onClick={() => setDialog('pass')}
              >
                <X className="size-4" /> {t.pass}
              </Button>
              <Button size="sm" className="h-11" loading={pending} onClick={onConnect}>
                <Heart className="size-4 fill-current" /> {t.connect}
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal open={dialog === 'menu'} onClose={() => setDialog(null)} title={t.more}>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" fullWidth onClick={() => setDialog('report')}>
            <Flag className="size-5" /> {dict.safety.report}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            className="text-danger"
            onClick={() => setDialog('block')}
          >
            <Ban className="size-5" /> {t.block}
          </Button>
        </div>
      </Modal>
      <Modal open={dialog === 'pass'} onClose={() => setDialog(null)} title={t.passTitle}>
        <div className="flex flex-col gap-4">
          <p className="text-muted">{t.passConfirm}</p>
          <Button
            fullWidth
            variant="secondary"
            loading={busy}
            onClick={() =>
              startBusy(async () => {
                await onPass()
                setDialog(null)
              })
            }
          >
            <X className="size-5" /> {t.pass}
          </Button>
        </div>
      </Modal>
      <Modal open={dialog === 'block'} onClose={() => setDialog(null)} title={t.block}>
        <div className="flex flex-col gap-4">
          <p className="text-muted">{t.blockConfirm}</p>
          <Button
            variant="danger"
            fullWidth
            loading={busy}
            onClick={() =>
              startBusy(async () => {
                await onBlock()
                setDialog(null)
              })
            }
          >
            <Ban className="size-5" /> {t.block}
          </Button>
        </div>
      </Modal>
      {dialog === 'report' && (
        <ReportDialog
          open
          onClose={() => setDialog(null)}
          targetType="random_session"
          targetId={session.id}
          note={t.reportNote}
        />
      )}
    </>
  )
}
