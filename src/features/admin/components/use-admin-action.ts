'use client'

import { useState, useTransition } from 'react'
import type { ActionResult } from '@/types/action-result'

// Like useModeration, for actions that return data: resolves to { ok, data } and keeps the error.
export function useAdminAction() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  const run = <T>(action: () => Promise<ActionResult<T>>) =>
    new Promise<ActionResult<T>>((resolve) =>
      startTransition(async () => {
        setError(undefined)
        const result = await action()
        if (!result.ok) setError(result.error)
        resolve(result)
      }),
    )

  return { pending, error, setError, run }
}

// Saves text produced by a server action (CSV, JSON) as a file.
export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
