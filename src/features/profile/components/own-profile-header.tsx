import { MapPin } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { VerifiedBadge } from '@/components/ui/verified-badge'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { OwnPhoto } from '../queries'

type Props = {
  name: string
  age: number | null
  city: string
  verified: boolean
  mainPhoto: OwnPhoto | null
  t: Dictionary['avatar']
}

// Top of the own profile page: big round main photo, name, age, ✓ and city.
export function OwnProfileHeader({ name, age, city, verified, mainPhoto, t }: Props) {
  return (
    <div className="flex items-center gap-4">
      <Avatar photo={mainPhoto} alt={t.yourPhoto} size={88} className="ring-accent/40 ring-2" />
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="flex min-w-0 items-center gap-1.5 text-2xl font-bold">
          <span className="truncate">
            {name}
            {age !== null && <span className="font-normal">, {age}</span>}
          </span>
          {verified && <VerifiedBadge size={22} />}
        </h2>
        {city && (
          <p className="text-muted flex items-center gap-1 text-sm">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{city}</span>
          </p>
        )}
      </div>
    </div>
  )
}
