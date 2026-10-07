'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { toggleLike } from '../actions'

// Optimistic like; rolls back if the server refuses.
export function LikeButton({
  postId,
  liked,
  count,
}: {
  postId: string
  liked: boolean
  count: number
}) {
  const { dict } = useI18n()
  const [state, setState] = useState({ liked, count })
  const [, startTransition] = useTransition()

  const toggle = () => {
    const prev = state
    setState({ liked: !prev.liked, count: prev.count + (prev.liked ? -1 : 1) })
    startTransition(async () => {
      const result = await toggleLike(postId)
      if (!result.ok) setState(prev)
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={state.liked}
      aria-label={dict.feed.like}
      className={cn(
        'flex items-center gap-1.5 text-sm',
        state.liked ? 'text-accent' : 'text-muted',
      )}
    >
      <Heart className={cn('size-5', state.liked && 'fill-current')} aria-hidden />
      <span className="tabular-nums">{state.count}</span>
    </button>
  )
}
