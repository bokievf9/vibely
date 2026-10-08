'use client'

import { CirclePause } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { setDiscoverable } from '../actions'
import { SwitchRow } from './switch-row'

// Settings → Privacy. The switch shows "paused"; the database stores the opposite, `discoverable`.
export function PauseToggle({ discoverable }: { discoverable: boolean }) {
  const { dict } = useI18n()
  return (
    <SwitchRow
      icon={CirclePause}
      label={dict.settings.pause}
      hint={dict.settings.pauseHint}
      initial={!discoverable}
      save={(paused) => setDiscoverable(!paused)}
    />
  )
}
