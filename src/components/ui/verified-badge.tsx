'use client'

import { BadgeCheck } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

type Props = { size?: number; className?: string }

// Selfie-verified ✓. Other people's profiles are only readable when verification_status is
// 'approved' (RLS `can_view_profile`, swipe candidates, randomizer), so wherever another person's
// name is shown they are verified; the own profile passes its status explicitly.
export function VerifiedBadge({ size = 20, className }: Props) {
  const { dict } = useI18n()
  return (
    <BadgeCheck
      role="img"
      aria-label={dict.avatar.verified}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 fill-sky-500 text-white', className)}
    />
  )
}
