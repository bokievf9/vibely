'use client'

import { ShieldAlert } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { isRisky } from '../risk'

// Shown under the other person's message when it looks like a scam signal (contacts, links,
// money). Purely advisory: the message itself is never blocked.
export function RiskWarning({ text }: { text: string }) {
  const { dict } = useI18n()
  if (!isRisky(text)) return null
  return (
    <p role="note" className="flex items-start gap-1.5 px-1 pt-1 text-xs text-amber-400">
      <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      {dict.chatSafety.riskWarning}
    </p>
  )
}
