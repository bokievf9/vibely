'use client'

import { BadgeCheck } from 'lucide-react'
import { useOptionalI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

type Props = { size?: number; className?: string; label?: string }

// The one selfie-verified mark: use it everywhere a verified person is shown (do not draw a
// BadgeCheck by hand). Other people's profiles are only readable when verification_status is
// 'approved' (RLS `can_view_profile`, swipe candidates, randomizer), so wherever another person's
// name is shown they are verified; the own profile passes its status explicitly.
export function VerifiedBadge({ size = 20, className, label }: Props) {
  // Also renders in the admin panel, which has no i18n provider.
  const i18n = useOptionalI18n()
  const text = label ?? i18n?.dict.avatar.verified ?? 'Verified'
  return (
    <BadgeCheck
      role="img"
      aria-label={text}
      width={size}
      height={size}
      strokeWidth={2.25}
      className={cn('fill-verified text-foreground inline-block shrink-0', className)}
    />
  )
}
