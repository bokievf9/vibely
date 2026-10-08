'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { swipe } from '@/features/swipe/actions'

// Profile opened from search: like it like a Discover card. A mutual like opens the new chat.
export function ProfileLikeButton({ userId, liked }: { userId: string; liked: boolean }) {
  const { dict } = useI18n()
  const t = dict.username
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [done, setDone] = useState(liked)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const like = () =>
    startTransition(async () => {
      const result = await swipe({ targetId: userId, direction: 'like' })
      if (!result.ok) return setError(result.error)
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
      {done && <p className="text-muted text-center text-sm">{t.likedHint}</p>}
    </div>
  )
}
