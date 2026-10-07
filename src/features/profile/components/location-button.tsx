'use client'

import { useState } from 'react'
import { Check, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'

type Location = { lat: number; lng: number }
type Props = { value: Location | null; onChange: (value: Location | null) => void }

// Exact coordinates are stored server-side only; other users see a rounded distance.
export function LocationButton({ value, onChange }: Props) {
  const { dict } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorKey>()

  const locate = () => {
    if (!('geolocation' in navigator)) return setError('geoUnavailable')
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLoading(false)
        setError(undefined)
        onChange({ lat: coords.latitude, lng: coords.longitude })
      },
      () => {
        setLoading(false)
        setError('geoFailed')
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="secondary" onClick={locate} loading={loading} fullWidth>
        {value ? <Check className="size-5" /> : <MapPin className="size-5" />}
        {value ? dict.location.detected : dict.location.detect}
      </Button>
      <p className={error ? 'text-sm text-red-400' : 'text-muted text-sm'}>
        {error ? dict.errors[error] : dict.location.hint}
      </p>
    </div>
  )
}
