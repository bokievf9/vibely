'use client'

import { CheckCheck } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { SwitchRow } from '@/features/settings/components/switch-row'
import { setSendReadReceipts } from '../actions'

// Settings → Privacy. Fair both ways (like WhatsApp): off hides the viewer's read state from
// everyone and hides everyone's from the viewer, VIP or not.
export function ReadReceiptsToggle({
  initial,
  available,
}: {
  initial: boolean
  available: boolean
}) {
  const { dict } = useI18n()
  const t = dict.vipPerks.receipts
  return (
    <SwitchRow
      icon={CheckCheck}
      label={t.setting}
      hint={available ? t.hint : `${t.hint} ${t.vipHint}`}
      initial={initial}
      save={setSendReadReceipts}
    />
  )
}
