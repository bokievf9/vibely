import Link from 'next/link'
import { ChevronRight, Crown, Sparkles } from 'lucide-react'
import { groupedRowClassName } from '@/components/ui/grouped'
import { fmt, localePath } from '@/i18n/config'
import { formatDay } from '@/i18n/format'
import { getDictionary, getLocale } from '@/i18n/server'
import { cn } from '@/lib/utils'
import { getAccess } from '../queries'
import { PLAN_ICONS } from './plan-ui-icons'

// Server-rendered ways into /plans: the Settings row, the own-profile plan row and the small chip
// in the Likes and Visitors headers. Hidden while my_access is not deployed (plans unknown).

async function planLine() {
  const [access, dict, locale] = await Promise.all([getAccess(), getDictionary(), getLocale()])
  const t = dict.plans
  const line = access.isStaff
    ? t.staff
    : access.planUntil && access.plan !== 'free'
      ? fmt(t.rowUntil, { plan: t.names[access.plan], date: formatDay(access.planUntil, locale) })
      : t.names[access.plan]
  return { access, dict, locale, line }
}

const markClass = {
  free: 'bg-accent/15 text-accent',
  plus: 'bg-accent/15 text-accent',
  vip: 'bg-vip/15 text-vip',
} as const

// Settings, first row: "Vibely Plus and VIP", the current plan under it.
export async function PlansSettingsRow() {
  const { access, dict, locale, line } = await planLine()
  if (!access.available) return null
  const t = dict.plans
  return (
    <Link
      href={localePath(locale, '/plans')}
      className={cn('card overflow-hidden', groupedRowClassName)}
    >
      <span className={cn('icon-tile', markClass[access.plan])}>
        {access.plan === 'vip' ? (
          <Crown className="fill-vip/25 size-[1.125rem]" aria-hidden />
        ) : (
          <Sparkles className="size-[1.125rem]" aria-hidden />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{t.entry.settingsTitle}</span>
        <span className="text-muted text-footnote font-normal text-pretty">
          {`${t.row}: ${line}. ${t.entry.settingsHint}`}
        </span>
      </span>
      <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
    </Link>
  )
}

// Own profile: "Plan" with the current level on the right.
export async function PlanProfileRow() {
  const { access, dict, locale, line } = await planLine()
  if (!access.available) return null
  const Icon = PLAN_ICONS[access.plan]
  return (
    <Link href={localePath(locale, '/plans')} className={groupedRowClassName}>
      <span className={cn('icon-tile', markClass[access.plan])}>
        <Icon
          className={cn('size-[1.125rem]', access.plan === 'vip' && 'fill-vip/25')}
          aria-hidden
        />
      </span>
      <span className="min-w-0 flex-1 truncate">{dict.plans.entry.profileRow}</span>
      <span
        className={cn(
          'text-footnote max-w-[55%] truncate font-semibold',
          access.plan === 'vip'
            ? 'text-vip'
            : access.plan === 'plus'
              ? 'text-accent'
              : 'text-muted',
        )}
      >
        {line}
      </span>
      <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
    </Link>
  )
}

// Header chip (Likes, Visitors) for everyone below VIP.
export async function PlansChip() {
  const { access, dict, locale } = await planLine()
  if (!access.available || access.isStaff || access.plan === 'vip') return null
  return (
    <Link
      href={localePath(locale, '/plans')}
      className={cn(
        'border-vip/30 bg-vip/10 text-vip relative mr-2 inline-flex h-8 items-center gap-1.5 rounded-full border px-3',
        "text-[13px] font-semibold before:absolute before:-inset-1.5 before:content-['']",
        'transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]',
      )}
    >
      <Crown className="fill-vip/25 size-3.5" aria-hidden />
      {dict.plans.entry.upgrade}
    </Link>
  )
}
