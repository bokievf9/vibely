'use client'

import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useI18n, useLocaleRouter } from '@/i18n/client'
import { PushSoftPrompt } from '@/features/push/components/push-soft-prompt'

type Props = { match: { id: string; name: string } | null; onClose: () => void }

export function MatchModal({ match, onClose }: Props) {
  const { dict } = useI18n()
  const router = useLocaleRouter()
  return (
    <Modal open={match !== null} onClose={onClose} title={dict.swipe.matchTitle}>
      <div className="flex flex-col items-center gap-5 text-center">
        <Heart className="fill-accent text-accent size-16 animate-pulse" aria-hidden />
        <p className="text-lg">{match && fmt(dict.swipe.matchSubtitle, { name: match.name })}</p>
        <PushSoftPrompt />
        <div className="flex w-full flex-col gap-2">
          <Button fullWidth onClick={() => match && router.push(`/chats/${match.id}`)}>
            {dict.swipe.sendMessage}
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose}>
            {dict.swipe.keepSwiping}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
