'use client'

import Image from 'next/image'
import { Eye, Heart, UserRound } from 'lucide-react'
import { EmptyState } from '@/components/layout/empty-state'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { daysAgo } from '@/i18n/format'
import type { ProfileVisitors } from '../types'
import { Button } from '@/components/ui/button'
import { UpgradeCard } from '@/features/plans/components/upgrade-card'
import { useAccess } from '@/features/plans/components/access-provider'

const PLACEHOLDERS = 6

// "Who viewed you". VIP: the people (tap opens the profile, Like from there). Everybody else: the
// count, blurred placeholder avatars (no real photos ever reach a non-VIP browser) and the upsell.
export function VisitorsList({ data }: { data: ProfileVisitors }) {
  const { dict } = useI18n()
  const { showUpgrade } = useAccess()
  const t = dict.vipPerks.visitors
  const countText = data.count === 1 ? t.countOne : fmt(t.countMany, { count: data.count })

  if (data.count === 0) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-4 pb-8">
        <EmptyState icon={Eye} title={t.empty} text={t.emptyHint} />
        {!data.full && <UpgradeCard feature="profile_visitors" compact text={t.lockedText} />}
        <p className="text-muted px-1 text-center text-sm">{t.incognitoHint}</p>
      </div>
    )
  }

  if (!data.full) {
    return (
      <div className="flex flex-col gap-5 px-4 pt-2 pb-8">
        <div className="flex flex-col items-center gap-4 pt-4 text-center">
          <div aria-hidden className="flex -space-x-3">
            {Array.from({ length: Math.min(data.count, PLACEHOLDERS) }, (_, i) => (
              <span
                key={i}
                className="border-background size-14 rounded-full border-2 bg-[radial-gradient(circle_at_35%_30%,rgb(255_255_255/0.35),transparent_45%),linear-gradient(135deg,var(--accent),var(--accent-deep))] blur-[3px]"
                style={{ opacity: 1 - i * 0.1 }}
              />
            ))}
          </div>
          <p className="text-[17px] font-semibold tracking-[-0.01em]">{countText}</p>
        </div>
        {/* Same card and sheet as every other plan gate (plans, 20261009000280). */}
        <UpgradeCard feature="profile_visitors" compact text={t.lockedText} />
        <Button
          fullWidth
          onClick={() => showUpgrade({ feature: 'profile_visitors', reason: 'feature' })}
        >
          {t.lockedTitle}
        </Button>
        <p className="text-muted px-1 text-center text-sm">{t.incognitoHint}</p>
      </div>
    )
  }

  const when = (iso: string) => {
    const days = daysAgo(iso)
    return days === 0
      ? t.viewedToday
      : days === 1
        ? t.viewedYesterday
        : fmt(t.viewedDaysAgo, { days })
  }

  return (
    <div className="flex flex-col gap-3 px-4 pt-1 pb-8">
      <p className="text-muted text-callout px-1">{countText}</p>
      <ul className="border-border bg-surface-raised flex flex-col overflow-hidden rounded-[1.375rem] border">
        {data.visitors.map((v) => (
          <li key={v.id} className="border-border border-b last:border-b-0">
            <LocaleLink
              href={`/profile/${v.id}?from=visitors`}
              className="active:bg-fill flex min-h-16 items-center gap-3 px-3 py-2.5 transition-colors"
            >
              <span className="bg-fill relative size-12 shrink-0 overflow-hidden rounded-full">
                {v.photo ? (
                  <Image
                    src={v.photo.url}
                    alt=""
                    width={v.photo.width}
                    height={v.photo.height}
                    sizes="48px"
                    className="size-full object-cover"
                  />
                ) : (
                  <UserRound className="text-muted m-auto size-6 h-full" aria-hidden />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-baseline text-[16px] font-semibold tracking-[-0.01em]">
                  <span className="truncate">{v.name}</span>
                  <span className="shrink-0 font-normal">, {v.age}</span>
                </span>
                <span className="text-muted text-sm">{when(v.visitedAt)}</span>
              </span>
              {v.liked && (
                <span className="text-accent flex shrink-0 items-center gap-1 text-xs font-semibold">
                  <Heart className="size-3.5 fill-current" aria-hidden />
                  <span className="sr-only sm:not-sr-only">{t.liked}</span>
                </span>
              )}
            </LocaleLink>
          </li>
        ))}
      </ul>
      <p className="text-muted px-1 text-sm">{t.incognitoHint}</p>
    </div>
  )
}
