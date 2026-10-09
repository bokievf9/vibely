'use client'

import { Check, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { perkLines } from '../perks'
import type { PromoOutcome } from '../schemas'

type Props = { outcome: PromoOutcome | null; onClose: () => void }

// Success sheet after a code is accepted: what was granted (with dates) or reserved (with
// durations, until the selfie check approves the profile).
export function PerksSheet({ outcome, onClose }: Props) {
  const { dict, locale } = useI18n()
  const t = dict.promo
  const granted = outcome?.status === 'granted'
  return (
    <Modal
      open={outcome !== null}
      onClose={onClose}
      title={granted ? t.grantedTitle : t.pendingTitle}
      footer={
        <Button fullWidth onClick={onClose}>
          {t.done}
        </Button>
      }
    >
      {outcome && (
        <div className="flex flex-col gap-4 pb-1">
          <div className="flex items-start gap-3">
            <span className="bg-vip/15 flex size-11 shrink-0 items-center justify-center rounded-full">
              <Crown className="fill-vip/25 text-vip size-6" aria-hidden />
            </span>
            <p className="text-body pt-2">
              {fmt(granted ? t.grantedBody : t.pendingBody, { code: outcome.code })}
            </p>
          </div>
          <ul className="card divide-border flex flex-col divide-y">
            {perkLines(outcome, dict, locale).map((line) => (
              <li key={line} className="flex items-center gap-3 px-4 py-3">
                <Check className="text-success size-5 shrink-0" aria-hidden />
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted text-footnote px-1">{t.nonTransferable}</p>
        </div>
      )}
    </Modal>
  )
}
