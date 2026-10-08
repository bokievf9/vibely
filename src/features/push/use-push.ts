'use client'

import { useCallback, useEffect, useState } from 'react'
import { disablePush, enablePush, getPushStatus, type PushStatus } from './client'

export function usePush({ sync = false }: { sync?: boolean } = {}) {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    getPushStatus(sync)
      .catch(() => 'unsupported' as const)
      .then((next) => {
        if (active) setStatus(next)
      })
    return () => {
      active = false
    }
  }, [sync])

  const enable = useCallback(async () => {
    setBusy(true)
    setFailed(false)
    const next = await enablePush()
    setBusy(false)
    if (next === 'failed') setFailed(true)
    else setStatus(next)
    return next === 'on'
  }, [])

  const disable = useCallback(async () => {
    setBusy(true)
    await disablePush().catch((e: unknown) => console.error('[push] unsubscribe failed', e))
    setBusy(false)
    setStatus('off')
  }, [])

  return { status, busy, failed, enable, disable }
}
