'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const FLASH_MS = 4_000

// A value that clears itself after a few seconds (errors above the composer). Showing a new value
// restarts the timer; the timer never outlives the component.
export function useFlash<T>(ms = FLASH_MS) {
  const [value, setValue] = useState<T | undefined>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const show = useCallback(
    (next: T | undefined | null) => {
      clearTimeout(timer.current)
      setValue(next ?? undefined)
      if (next != null) timer.current = setTimeout(() => setValue(undefined), ms)
    },
    [ms],
  )
  return [value, show] as const
}
