'use client'

import { useRef, useState, useTransition } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { toggleLike } from '../actions'
import { formatCount } from './format-count'
import { useUpgradeHandler } from '@/features/plans/components/access-provider'

// Optimistic like; rolls back if the server refuses. Liking pops the heart (spring, so a fast
// double tap retargets instead of restarting) and gives a light haptic on Android.
export function LikeButton({
  postId,
  liked,
  count,
}: {
  postId: string
  liked: boolean
  count: number
}) {
  const { dict, locale } = useI18n()
  const upgradeOr = useUpgradeHandler()
  const [state, setState] = useState({ liked, count })
  const [, startTransition] = useTransition()
  const heart = useRef<SVGSVGElement>(null)
  const reduce = useReducedMotion()

  const toggle = () => {
    const prev = state
    const next = !prev.liked
    setState({ liked: next, count: prev.count + (next ? 1 : -1) })
    if (next) {
      haptic('light')
      if (heart.current && !reduce) {
        animate(
          heart.current,
          { transform: ['scale(0.7)', 'scale(1)'] },
          { type: 'spring', duration: 0.4, bounce: 0.4 },
        )
      }
    }
    startTransition(async () => {
      const result = await toggleLike(postId)
      if (!result.ok) {
        setState(prev)
        upgradeOr(result)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={state.liked}
      aria-label={`${dict.feed.like}: ${state.count}`}
      className={cn(
        'active:bg-fill flex h-11 min-w-11 items-center gap-2 rounded-full px-3 text-[15px] font-medium transition-colors',
        state.liked ? 'text-accent' : 'text-muted',
      )}
    >
      <Heart
        ref={heart}
        className={cn('size-[1.375rem] shrink-0', state.liked && 'fill-current')}
        aria-hidden
      />
      <span className="tabular-nums">{formatCount(state.count, locale)}</span>
    </button>
  )
}
