'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { swipe } from '@/features/swipe/actions'
import { useUpgradeHandler } from '@/features/plans/components/access-provider'

// Profile opened from people search or Crossed paths: a "secret like", which is exactly a
// Discover like (same swipes insert): the other person learns of it only in "Who liked you" or
// through the match. A mutual like opens the new chat.
export function ProfileLikeButton({ userId, liked }: { userId: string; liked: boolean }) {
  const { dict } = useI18n()
  const t = dict.username
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const upgradeOr = useUpgradeHandler()
  const [done, setDone] = useState(liked)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const like = () =>
    startTransition(async () => {
      const result = await swipe({ targetId: userId, direction: 'like' })
      if (!result.ok) return upgradeOr(result) ? undefined : setError(result.error)
      setError(undefined)
      if (result.data.matchId) return router.push(`/chats/${result.data.matchId}`)
      setDone(true)
    })

  return (
    <div className="mt-2 flex flex-col gap-2">
      <FormError message={errorText(error)} />
      <Button onClick={like} loading={pending} disabled={done} fullWidth>
        <Heart className="size-5" fill={done ? 'currentColor' : 'none'} aria-hidden />
        {done ? t.liked : t.like}
      </Button>
      <p className="text-muted text-center text-sm">{done ? t.likedHint : t.likeHint}</p>
    </div>
  )
}
