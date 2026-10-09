import { MapPin } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { VerifiedBadge } from '@/components/ui/verified-badge'
import { VipBadge } from '@/components/ui/vip-badge'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { OwnPhoto } from '../queries'

type Props = {
  name: string
  username: string
  age: number | null
  city: string
  verified: boolean
  // VIP right now (promo codes); shown after the verified mark.
  vip?: boolean
  mainPhoto: OwnPhoto | null
  t: Dictionary['avatar']
}

// Top of the own profile page: a large main photo in a gradient ring, then name, age, ✓,
// @username and city, centered like a profile hero.
export function OwnProfileHeader({
  name,
  username,
  age,
  city,
  verified,
  vip = false,
  mainPhoto,
  t,
}: Props) {
  return (
    <div className="flex flex-col items-center gap-4 pt-2 text-center">
      <span className="relative">
        {/* Soft bloom behind the photo, then the accent ring with a background-colored gap. */}
        <span aria-hidden className="bg-accent/30 absolute inset-2 rounded-full blur-2xl" />
        <span className="bg-accent-gradient relative flex rounded-full p-[3px]">
          <span className="bg-background flex rounded-full p-[3px]">
            <Avatar photo={mainPhoto} alt={t.yourPhoto} size={116} />
          </span>
        </span>
      </span>
      <div className="flex w-full min-w-0 flex-col items-center gap-1">
        <h2 className="text-title flex max-w-full min-w-0 items-center justify-center gap-1.5">
          <span className="truncate">
            {name}
            {age !== null && <span className="font-normal text-white/80">, {age}</span>}
          </span>
          {verified && <VerifiedBadge size={22} />}
          {vip && <VipBadge size={20} />}
        </h2>
        <p className="text-muted text-callout flex max-w-full min-w-0 items-center justify-center gap-1.5">
          <span className="truncate">@{username}</span>
          {city && (
            <>
              <span aria-hidden className="bg-muted/60 size-1 shrink-0 rounded-full" />
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{city}</span>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
