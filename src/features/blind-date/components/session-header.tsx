'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Ban, ChevronLeft, Flag, Heart, MoreHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { HeaderEdge, headerActionClassName, headerBarClassName } from '@/components/layout/header-styles'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { ReportDialog } from '@/features/safety/components/report-dialog'
import type { BlindSession } from '../types'
import { AliasAvatar } from './alias-avatar'

type Props = {
  session: BlindSession
  pending: boolean
  /** Replaces the subtitle (the night's title during a Blind Dating Night). */
  hint?: string
  onConnect: () => void
  onPass: () => Promise<void>
  onBlock: () => Promise<void>
  /** Back chevron on the left (conversations opened from Chats). */
  back?: { href: string; label: string }
  /** Who is shown instead of the alias (private replies, prompt conversations). */
  identity?: { avatar: ReactNode; title: string; subtitle: string }
  /** Connect button wording; `lockedHint` disables it and explains why. */
  connect?: { label: string; lockedHint?: string; waitingText?: string }
}

// Who you are talking to (alias + abstract avatar by default), report/block, and the Connect / Pass
// bar that stays reachable under the header for the whole conversation.
export function SessionHeader({
  session,
  pending,
  hint: hintOverride,
  onConnect,
  onPass,
  onBlock,
  back,
  identity,
  connect,
}: Props) {
  const { dict } = useI18n()
  const t = dict.blindDate
  const [dialog, setDialog] = useState<'menu' | 'pass' | 'block' | 'report' | null>(null)
  const [busy, startBusy] = useTransition()
  const active = session.state === 'active'
  const hint =
    hintOverride ??
    (session.commonTags.length
      ? fmt(t.commonTags, {
          tags: session.commonTags.map((tag) => dict.tags[tag] ?? tag).join(', '),
        })
      : t.anonymousHint)
  const locked = Boolean(connect?.lockedHint)

  return (
    <>
      <header className={cn(headerBarClassName, 'gap-3', back ? 'pr-4 pl-1' : 'px-4')}>
        {back && (
          <LocaleLink
            href={back.href}
            aria-label={back.label}
            className={cn(headerActionClassName, '-mr-1')}
          >
            <ChevronLeft className="size-7" strokeWidth={2.2} />
          </LocaleLink>
        )}
        {identity?.avatar ?? <AliasAvatar alias={session.partnerAlias} size={36} />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base leading-tight font-semibold">
            {identity?.title ?? fmt(t.partner, { n: session.partnerAlias })}
          </h1>
          <p className="text-muted truncate text-xs">{identity?.subtitle ?? hint}</p>
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
              <p className="min-w-0 flex-1 text-sm">{connect?.waitingText ?? t.waiting}</p>
              <Button size="sm" variant="ghost" onClick={() => setDialog('pass')}>
                {t.pass}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
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
                <Button
                  size="sm"
                  className="h-11"
                  loading={pending}
                  disabled={locked}
                  aria-describedby={locked ? 'connect-locked' : undefined}
                  onClick={onConnect}
                >
                  <Heart className="size-4 fill-current" /> {connect?.label ?? t.connect}
                </Button>
              </div>
              {locked && (
                <p id="connect-locked" className="text-muted text-footnote text-center" role="status">
                  {connect?.lockedHint}
                </p>
              )}
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
