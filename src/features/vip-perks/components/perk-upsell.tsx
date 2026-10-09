'use client'

import { Crown } from 'lucide-react'
import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

export type PerkKey = 'read_receipts' | 'profile_visitors' | 'message_before_match'

// Stand-in for the plans system's <UpgradeCard feature="..."/> (feature/plans app helpers): the
// same props, so the call sites switch over by changing the import. The CTA leads to Settings,
// where promo codes unlock VIP until purchases exist.
export function PerkUpsell({
  feature,
  title,
  text,
  className,
}: {
  feature: PerkKey
  title: string
  text: string
  className?: string
}) {
  const { dict } = useI18n()
  return (
    <div
      data-feature={feature}
      className={cn(
        'border-vip/30 bg-vip/[0.07] flex flex-col gap-3 rounded-[1.375rem] border p-4',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="bg-vip/15 text-vip flex size-10 shrink-0 items-center justify-center rounded-full">
          <Crown className="fill-vip/25 size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[16px] font-semibold tracking-[-0.01em]">{title}</p>
          <p className="text-muted text-sm">{text}</p>
        </div>
      </div>
      <LocaleLink
        href="/settings"
        className="bg-vip flex h-11 items-center justify-center rounded-2xl text-[15px] font-semibold text-black transition-[transform,scale] duration-150 ease-out active:scale-[0.97]"
      >
        {dict.vipPerks.upsellCta}
      </LocaleLink>
    </div>
  )
}
