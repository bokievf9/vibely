'use client'

import { Crown } from 'lucide-react'
import { useOptionalI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

type Props = { size?: number; className?: string; label?: string }

// The one VIP mark (promo codes, 20261009000230): a small crown in the --vip token next to the
// name, after the verified badge. Expiry is decided by the database (is_vip / vip_ids), so render
// it only where the data says the person is VIP right now.
export function VipBadge({ size = 18, className, label }: Props) {
  // Also renders in the admin panel, which has no i18n provider.
  const i18n = useOptionalI18n()
  const text = label ?? i18n?.dict.promo.badge ?? 'VIP'
  return (
    <Crown
      role="img"
      aria-label={text}
      width={size}
      height={size}
      strokeWidth={2.25}
      className={cn('fill-vip/25 text-vip inline-block shrink-0', className)}
    />
  )
}
