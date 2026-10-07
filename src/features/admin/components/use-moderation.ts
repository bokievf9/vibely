'use client'

import { useState, useTransition } from 'react'
import type { ActionResult } from '@/types/action-result'

// Runs a moderation action with pending/error state. Returns true on success.
export function useModeration() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  const run = (action: () => Promise<ActionResult>) =>
    new Promise<boolean>((resolve) =>
      startTransition(async () => {
        setError(undefined)
        const result = await action()
        if (!result.ok) setError(result.error)
        resolve(result.ok)
      }),
    )

  return { pending, error, run }
}
