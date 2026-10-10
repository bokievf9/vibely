'use client'

import { useEffect, useState } from 'react'
import { Check, Heart, Share2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { publicEnv } from '@/lib/env'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { REF_PARAM } from '@/features/referrals/constants'
import { createCrushInvite } from '@/features/crush/actions'
import { useAccess } from '@/features/plans/components/access-provider'
import { UpgradeCard } from '@/features/plans/components/upgrade-card'

// Invite friends: Web Share sheet on phones, copy-to-clipboard elsewhere.
// "I have a crush on this person" turns the share into a single-use crush link (created on the
// server at share time, never before): the link itself is all we ever hold about the invitee.
export function InviteCard({ code, invited }: { code: string; invited: number }) {
  const { dict, locale } = useI18n()
  const t = dict.discover
  const tc = dict.crush
  const [copied, setCopied] = useState(false)
  const [crush, setCrush] = useState(false)
  // The crush link made for this card: shared again on a second tap instead of burning another
  // of the plan's links for 30 days. Switching the option off and on starts a fresh one.
  const [crushCode, setCrushCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  // Crush links per 30 days from the plan (free 1, Plus 3, VIP 5; 20261009000280).
  const { limit, remaining, recordUse, showUpgrade, plan, isStaff } = useAccess()
  const crushLimit = limit('crush_links_per_30d')
  const crushLeft = remaining('crush_links_per_30d')
  const link = (c: string) => `${publicEnv.NEXT_PUBLIC_SITE_URL}/${locale}?${REF_PARAM}=${c}`

  // "Link copied" reverts after a moment; the timer dies with the card.
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timer)
  }, [copied])

  const shareUrl = async (url: string, message: string) => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Vibely', text: message, url })
        return
      } catch (e) {
        // The user closed the share sheet: nothing to do.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${message} ${url}`)
      setCopied(true)
    } catch {
      window.prompt(t.inviteShare, url)
    }
  }

  const share = async () => {
    if (!crush) return shareUrl(link(code), t.inviteMessage)
    setBusy(true)
    setNote(null)
    try {
      let c = crushCode
      if (!c) {
        const result = await createCrushInvite()
        if ('error' in result) {
          if (result.error === 'plan') return showUpgrade(result.upgrade)
          setNote(result.error === 'limit' ? tc.inviteLimitReached : tc.inviteFailed)
          return
        }
        recordUse('crush_links_per_30d')
        c = result.code
        setCrushCode(c)
      }
      await shareUrl(link(c), tc.crushMessage)
    } finally {
      setBusy(false)
    }
  }

  const toggleCrush = () => {
    setCrush((on) => !on)
    setCrushCode(null)
    setNote(null)
  }

  return (
    <div className="card flex flex-col gap-3 border p-4">
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
      <div className="border-border flex flex-col gap-1.5 border-t pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <Heart className="text-accent size-5 shrink-0" aria-hidden /> {tc.inviteOption}
          </span>
          <Switch checked={crush} onToggle={toggleCrush} label={tc.inviteOption} disabled={busy} />
        </div>
        {crush && (
          <>
            <p className="text-muted text-sm">{tc.inviteOptionHint}</p>
            <p className="text-muted text-sm tabular-nums">
              {crushLimit !== null && crushLeft !== null
                ? fmt(dict.plans.crushLeft, { count: crushLeft, limit: crushLimit })
                : tc.inviteLimit}
            </p>
            {/* Used up and a higher plan has more: say so before Share is tapped. */}
            {crushLeft === 0 && plan !== 'vip' && !isStaff && (
              <UpgradeCard feature="crush_links_per_30d" reason="limit" compact className="mt-1" />
            )}
          </>
        )}
        {note && (
          <p role="alert" className="text-danger text-sm">
            {note}
          </p>
        )}
      </div>
      <Button fullWidth onClick={() => void share()} loading={busy} aria-live="polite">
        {copied ? <Check className="size-5" /> : <Share2 className="size-5" />}
        {copied ? t.copied : crush ? tc.shareCrush : t.inviteShare}
      </Button>
    </div>
  )
}
