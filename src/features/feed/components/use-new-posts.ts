'use client'

import { useEffect, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'

// Counts posts published since the page loaded (private "feed" broadcast, ids only).
export function useNewPosts() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const client = getBrowserClient()
    const channel = client
      .channel('feed', { config: { private: true } })
      .on('broadcast', { event: 'new_post' }, () => setCount((c) => c + 1))
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [])

  return { count, reset: () => setCount(0) }
}
