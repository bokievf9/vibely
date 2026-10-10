'use client'

import { CheckCheck, ChevronRight, Crown } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { SwitchRow } from '@/features/settings/components/switch-row'
import { useAccess } from '@/features/plans/components/access-provider'
import { groupedRowClassName } from '@/components/ui/grouped'
import { cn } from '@/lib/utils'
import { setSendReadReceipts } from '../actions'

// Settings → Privacy. Fair both ways (like WhatsApp): off hides the viewer's read state from
// everyone and hides everyone's from the viewer, VIP or not. Sending is free; seeing when your
// own messages were read is VIP, so without it a row under the switch opens the upgrade sheet.
export function ReadReceiptsToggle({
  initial,
  available,
}: {
  initial: boolean
  available: boolean
}) {
  const { dict } = useI18n()
  const t = dict.vipPerks.receipts
  const { showUpgrade } = useAccess()
  return (
    <>
      <SwitchRow
        icon={CheckCheck}
        label={t.setting}
        hint={t.hint}
        initial={initial}
        save={setSendReadReceipts}
      />
      {!available && (
        <button
          type="button"
          onClick={() => showUpgrade({ feature: 'read_receipts', reason: 'feature' })}
          className={cn(groupedRowClassName, 'min-h-11 py-2 text-left')}
        >
          <span className="icon-tile bg-vip/15 text-vip">
            <Crown className="fill-vip/25 size-[1.125rem]" aria-hidden />
          </span>
          <span className="text-callout min-w-0 flex-1 font-normal text-pretty">{t.vipHint}</span>
          <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
        </button>
      )}
    </>
  )
}
