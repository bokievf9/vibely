'use client'

import { useEffect, useState } from 'react'
import { Check, Share2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { publicEnv } from '@/lib/env'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { REF_PARAM } from '@/features/referrals/constants'

// Invite friends: Web Share sheet on phones, copy-to-clipboard elsewhere.
export function InviteCard({ code, invited }: { code: string; invited: number }) {
  const { dict, locale } = useI18n()
  const t = dict.discover
  const [copied, setCopied] = useState(false)
  const url = `${publicEnv.NEXT_PUBLIC_SITE_URL}/${locale}?${REF_PARAM}=${code}`

  // "Link copied" reverts after a moment; the timer dies with the card.
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timer)
  }, [copied])

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Vibely', text: t.inviteMessage, url })
        return
      } catch (e) {
        // The user closed the share sheet: nothing to do.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${t.inviteMessage} ${url}`)
      setCopied(true)
    } catch {
      window.prompt(t.inviteShare, url)
    }
  }

  return (
    <div className="bg-surface border-border flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-start gap-3">
        <UserPlus className="text-accent size-6 shrink-0" aria-hidden />
        <div className="flex flex-col">
          <span className="font-medium">{t.invite}</span>
          <span className="text-muted text-sm">{t.inviteText}</span>
          {invited > 0 && (
            <span className="text-accent mt-1 text-sm font-medium">
              {fmt(t.invited, { count: invited })}
            </span>
          )}
        </div>
      </div>
      <Button fullWidth onClick={() => void share()} aria-live="polite">
        {copied ? <Check className="size-5" /> : <Share2 className="size-5" />}
        {copied ? t.copied : t.inviteShare}
      </Button>
    </div>
  )
}
