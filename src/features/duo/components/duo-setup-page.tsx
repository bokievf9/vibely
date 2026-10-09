'use client'

import { useState } from 'react'
import { useLocaleRouter } from '@/i18n/client'
import type { MyDuo } from '../types'
import { DuoSetup } from './duo-setup'

// /duo without an active duo: the setup; once a duo forms, on to the editor.
export function DuoSetupPage({ initial }: { initial: MyDuo }) {
  const router = useLocaleRouter()
  const [duo, setDuo] = useState(initial)
  return (
    <DuoSetup
      duo={duo}
      onChange={(next) => {
        setDuo(next)
        if (next.team?.status === 'active') router.refresh()
      }}
    />
  )
}
