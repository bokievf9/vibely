'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { getBlindStats } from '../actions'

const POLL_MS = 15_000

// "People searching now: N" — polled while the start or waiting screen is open.
export function SearchingNow({ className }: { className?: string }) {
  const { dict } = useI18n()
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => void getBlindStats().then((n) => alive && setCount(n))
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  // Same line height before the first answer, so the filters below do not jump when it arrives.
  if (count === null) {
    return (
      <div className={cn('flex h-5 items-center', className)} aria-hidden>
        <Skeleton className="h-3.5 w-44 rounded-full" />
      </div>
    )
  }
  return (
    <p className={cn('text-muted flex min-h-5 items-center gap-1.5 text-sm', className)}>
      <span className="relative flex size-2" aria-hidden>
        <span className="bg-accent absolute inline-flex size-full animate-ping rounded-full opacity-60" />
        <span className="bg-accent relative inline-flex size-2 rounded-full" />
      </span>
      {fmt(dict.blindDate.searchingNow, { count })}
    </p>
  )
}
