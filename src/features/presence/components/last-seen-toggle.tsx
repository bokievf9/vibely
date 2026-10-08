'use client'

import { Eye } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { SwitchRow } from '@/features/settings/components/switch-row'
import { setShowLastSeen } from '../actions'

// Settings → Privacy. Telegram-like: hiding your last seen also hides everyone else's.
export function LastSeenToggle({ initial }: { initial: boolean }) {
  const { dict } = useI18n()
  return (
    <SwitchRow
      icon={Eye}
      label={dict.chats.showLastSeen}
      hint={dict.chats.showLastSeenHint}
      initial={initial}
      save={setShowLastSeen}
    />
  )
}
