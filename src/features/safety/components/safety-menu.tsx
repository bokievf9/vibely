'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { Ban, EllipsisVertical, Flag, HeartOff, ImageIcon, Phone, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useI18n, useLocaleRouter } from '@/i18n/client'
import { formatDay, formatTime } from '@/i18n/format'
import { formatCallDuration } from '@/features/calls/timeline'
import type { CallEntry } from '@/features/calls/types'
import { block } from '../actions'
import { ReportDialog } from './report-dialog'

type ReportablePhoto = { id: string; url: string; width: number; height: number }

type Props = {
  userId: string
  name: string
  onUnmatch?: () => Promise<unknown>
  // Profile view: lets the user report one specific photo.
  photos?: ReportablePhoto[]
  // Chat: lets the user report one specific call with this person.
  calls?: CallEntry[]
}

type Open = 'menu' | 'report' | 'block' | 'unmatch' | 'pickPhoto' | 'pickCall' | null
type Target = { type: 'photo' | 'call'; id: string } | null

// "⋮" menu on a matched profile or chat: report (the person, a photo or a call), block, unmatch.
export function SafetyMenu({ userId, name, onUnmatch, photos, calls }: Props) {
  const { dict, locale } = useI18n()
  const t = dict.reports
  const router = useLocaleRouter()
  const [open, setOpen] = useState<Open>(null)
  const [target, setTarget] = useState<Target>(null)
  const [pending, startTransition] = useTransition()
  // Calls still ringing or in progress can't be reported yet.
  const reportableCalls = calls?.filter((c) => c.status !== 'ringing' && c.status !== 'active')

  const confirmBlock = () =>
    startTransition(async () => {
      const result = await block({ userId })
      if (result.ok) router.replace('/chats')
    })

  const pick = (type: 'photo' | 'call', id: string) => {
    setTarget({ type, id })
    setOpen(null)
  }

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="…" onClick={() => setOpen('menu')}>
        <EllipsisVertical className="size-6" />
      </Button>
      <Modal open={open === 'menu'} onClose={() => setOpen(null)} title={name}>
        <div className="flex flex-col gap-2">
          {onUnmatch && (
            <Button variant="secondary" fullWidth onClick={() => setOpen('unmatch')}>
              <HeartOff className="size-5" /> {dict.chats.unmatch}
            </Button>
          )}
          <Button variant="secondary" fullWidth onClick={() => setOpen('report')}>
            <Flag className="size-5" /> {dict.safety.report}
          </Button>
          {!!photos?.length && (
            <Button variant="secondary" fullWidth onClick={() => setOpen('pickPhoto')}>
              <ImageIcon className="size-5" /> {t.reportPhoto}
            </Button>
          )}
          {calls && (
            <Button variant="secondary" fullWidth onClick={() => setOpen('pickCall')}>
              <Phone className="size-5" /> {t.reportCall}
            </Button>
          )}
          <Button variant="danger" fullWidth onClick={() => setOpen('block')}>
            <Ban className="size-5" /> {dict.safety.block}
          </Button>
        </div>
      </Modal>
      <ReportDialog
        open={open === 'report'}
        onClose={() => setOpen(null)}
        targetType="user"
        targetId={userId}
      />
      <Modal open={open === 'pickPhoto'} onClose={() => setOpen(null)} title={t.pickPhoto}>
        <ul className="grid grid-cols-3 gap-2">
          {photos?.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => pick('photo', p.id)}
                aria-label={fmt(t.photoN, { n: i + 1 })}
                className="block w-full overflow-hidden rounded-xl transition active:scale-95"
              >
                <Image
                  src={p.url}
                  alt=""
                  width={p.width}
                  height={p.height}
                  sizes="120px"
                  className="aspect-[3/4] w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      </Modal>
      <Modal open={open === 'pickCall'} onClose={() => setOpen(null)} title={t.pickCall}>
        {reportableCalls?.length ? (
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {reportableCalls.map((c) => (
              <li key={c.id}>
                <Button
                  variant="secondary"
                  fullWidth
                  className="justify-start"
                  onClick={() => pick('call', c.id)}
                >
                  {c.kind === 'video' ? <Video className="size-5" /> : <Phone className="size-5" />}
                  <span className="truncate">
                    {c.kind === 'video' ? t.videoCall : t.voiceCall},{' '}
                    {formatDay(c.startedAt, locale)} {formatTime(c.startedAt, locale)}
                    {c.durationSec !== null && `, ${formatCallDuration(c.durationSec)}`}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t.noCalls}</p>
        )}
      </Modal>
      <ReportDialog
        key={target ? `${target.type}:${target.id}` : 'none'}
        open={target !== null}
        onClose={() => setTarget(null)}
        targetType={target?.type ?? 'photo'}
        targetId={target?.id ?? ''}
        title={target?.type === 'call' ? t.callTitle : t.photoTitle}
        note={target?.type === 'call' ? t.reviewNote : undefined}
      />
      <Modal
        open={open === 'block' || open === 'unmatch'}
        onClose={() => setOpen(null)}
        title={open === 'block' ? dict.safety.block : dict.chats.unmatch}
      >
        <div className="flex flex-col gap-4">
          <p>
            {fmt(open === 'block' ? dict.safety.blockConfirm : dict.chats.unmatchConfirm, { name })}
          </p>
          <Button
            variant="danger"
            fullWidth
            loading={pending}
            onClick={
              open === 'block'
                ? confirmBlock
                : () =>
                    startTransition(async () => {
                      await onUnmatch?.()
                      router.replace('/chats')
                    })
            }
          >
            {open === 'block' ? dict.safety.block : dict.chats.unmatch}
          </Button>
        </div>
      </Modal>
    </>
  )
}
